import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import GithubSlugger from "github-slugger";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:components-nav";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

export type NavHeading = {
  id: string;
  title: string;
  depth: number;
  children: NavHeading[];
};

export type NavItem = {
  title: string;
  path: string;
  headings: NavHeading[];
  children?: NavItem[];
};

const FRONTMATTER_TITLE = /^---\r?\n[\s\S]*?^title:\s*(?:"([^"]*)"|'([^']*)'|(.+?))\s*$[\s\S]*?^---/m;
const FENCE = /^(?:```|~~~)[\s\S]*?^(?:```|~~~)\s*$/gm;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm;
const INLINE_MARKUP = /`([^`]*)`|\*\*([^*]*)\*\*|\*([^*]*)\*|_([^_]*)_|\[([^\]]*)\]\([^)]*\)|\{[^}]*\}/g;

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function plainText(value: string): string {
  return value.replace(INLINE_MARKUP, (_, code, bold, em, under, link) => code ?? bold ?? em ?? under ?? link ?? "").trim();
}

function nest(flat: Omit<NavHeading, "children">[]): NavHeading[] {
  const root: NavHeading[] = [];
  const stack: NavHeading[] = [];

  for (const heading of flat) {
    const node: NavHeading = { ...heading, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) stack.pop();
    (stack[stack.length - 1]?.children ?? root).push(node);
    stack.push(node);
  }

  return root;
}

function parse(source: string): { title?: string; headings: NavHeading[] } {
  const frontmatter = FRONTMATTER_TITLE.exec(source);
  const slugger = new GithubSlugger();
  const flat: Omit<NavHeading, "children">[] = [];

  for (const [, hashes, raw] of source.replace(FENCE, "").matchAll(HEADING)) {
    const title = plainText(raw);
    if (title === "") continue;
    flat.push({ id: slugger.slug(title), title, depth: hashes.length });
  }

  return {
    title: frontmatter?.[1] ?? frontmatter?.[2] ?? frontmatter?.[3] ?? flat.find((h) => h.depth === 1)?.title,
    headings: nest(flat),
  };
}

async function scan(dir: string, base: string): Promise<NavItem[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const items: NavItem[] = [];

  for (const entry of entries) {
    const source = join(dir, entry.name);
    if (entry.isDirectory()) {
      const children = await scan(source, `${base}/${entry.name}`);
      if (children.length > 0) {
        items.push({ title: titleFromSlug(entry.name), path: `${base}/${entry.name}`, headings: [], children });
      }
      continue;
    }
    if (extname(entry.name) !== ".mdx") continue;
    const slug = entry.name.slice(0, -".mdx".length);
    const { title, headings } = parse(await readFile(source, "utf8"));
    items.push({
      title: title ?? titleFromSlug(slug),
      path: slug === "index" ? base : `${base}/${slug}`,
      headings,
    });
  }

  return items.sort((a, b) => a.title.localeCompare(b.title));
}

export function componentsNav(options: { dir: string; base?: string } = { dir: "src/routes/(main)/components" }): Plugin {
  const base = options.base ?? "/components";
  let root = process.cwd();

  return {
    name: "components-nav",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return;
      const dir = join(root, options.dir);
      this.addWatchFile(dir);
      const tree = await scan(dir, base);
      return `export const nav = ${JSON.stringify(tree)};\nexport default nav;`;
    },
    handleHotUpdate({ file, server }) {
      const dir = join(root, options.dir);
      if (relative(dir, file).startsWith("..")) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: "full-reload" });
    },
  };
}
