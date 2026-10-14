import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import GithubSlugger from "github-slugger";
import type { Heading, Root as MdastRoot } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { Plugin } from "vite";

import { collectApi } from "../content/api/collect";
import type { ApiReferenceOptions } from "../content/api/types";
import { parseFrontmatter, stripFrontmatter, type SectionId } from "../content/frontmatter";
import { FRAMEWORK_IDS, mapFrameworks, type FrameworkId } from "../shared/frameworks";
import { API_SECTION_ID, slugifyWithin, titleFromSlug } from "../shared/text";

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
  /** Framework-relative path, e.g. `/components/dialog`. */
  path: string;
  top?: string;
  /** Page headings; the generated API reference headings differ per framework package. */
  headings: Record<FrameworkId, NavHeading[]>;
  children?: NavItem[];
};

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

const markdownParser = unified().use(remarkParse).use(remarkFrontmatter).use(remarkGfm);

function parseHeadings(body: string): { top: string | undefined; flat: { hash: string; title: string; depth: number }[] } {
  const tree = markdownParser.parse(body) as MdastRoot;
  const slugger = new GithubSlugger();
  const flat: { hash: string; title: string; depth: number }[] = [];
  let top: string | undefined;

  visit(tree, "heading", (node: Heading) => {
    const title = mdastToString(node).trim();
    if (title === "") return;
    const hash = slugger.slug(title);
    if (node.depth === 1) {
      top ??= hash;
      return;
    }
    flat.push({ hash, title, depth: node.depth });
  });

  return { top, flat };
}

const SECTION_HEADINGS: Partial<Record<SectionId, { id: string; title: string }>> = {
  api: { id: API_SECTION_ID, title: "API reference" },
};

function appendGenerated(
  flat: { hash: string; title: string; depth: number }[],
  sections: SectionId[],
  generated: Record<SectionId, NavHeading[]>,
): Omit<NavHeading, "children">[] {
  const result: Omit<NavHeading, "children">[] = flat.map((heading) => ({
    id: heading.hash,
    title: heading.title,
    depth: heading.depth,
  }));

  for (const section of sections) {
    const heading = SECTION_HEADINGS[section];
    const items = generated[section];
    if (heading === undefined || items === undefined || items.length === 0) continue;
    result.push({ id: heading.id, title: heading.title, depth: 2 });
    for (const item of items) result.push({ id: item.id, title: item.title, depth: 3 });
  }

  return result;
}

function parse(
  source: string,
  filePath: string,
  generated: Record<SectionId, NavHeading[]>,
): { title: string; top: string | undefined; headings: NavHeading[] } {
  const meta = parseFrontmatter(source, filePath);
  const body = stripFrontmatter(source);
  const { top, flat } = parseHeadings(body);
  const withGenerated = appendGenerated(flat, meta.sections, generated);

  return { title: meta.title, top, headings: nest(withGenerated) };
}

function apiHeadings(parts: { name: string }[]): NavHeading[] {
  if (parts.length <= 1) return [];
  return parts.map((part) => ({
    id: slugifyWithin(API_SECTION_ID, part.name),
    title: part.name,
    depth: 0,
    children: [],
  }));
}

type ApiParts = Record<FrameworkId, Record<string, { parts: { name: string }[] }>>;

async function scan(dir: string, base: string, api: ApiParts): Promise<NavItem[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const items: NavItem[] = [];

  for (const entry of entries) {
    const source = join(dir, entry.name);
    if (entry.isDirectory()) {
      const dirPath = `${base}/${entry.name}`;
      const children = await scan(source, dirPath, api);
      const pageIndex = children.findIndex((child) => child.path === dirPath);
      if (children.length === 0) continue;
      if (pageIndex === -1) {
        items.push({ title: titleFromSlug(entry.name), path: dirPath, headings: mapFrameworks(() => []), children });
        continue;
      }
      const [page] = children.splice(pageIndex, 1);
      if (children.length > 0) page.children = children;
      items.push(page);
      continue;
    }
    if (extname(entry.name) !== ".mdx") continue;
    const slug = entry.name.slice(0, -".mdx".length);
    const componentSlug = slug === "index" ? (base.split("/").pop() ?? slug) : slug;
    const text = await readFile(source, "utf8");
    const pages = mapFrameworks((framework) => {
      const generated: Record<SectionId, NavHeading[]> = {
        demo: [],
        anatomy: [],
        api: apiHeadings(api[framework][componentSlug]?.parts ?? []),
        types: [],
      };
      return parse(text, source, generated);
    });
    const first = pages[FRAMEWORK_IDS[0]];
    items.push({
      title: first.title || titleFromSlug(slug),
      path: slug === "index" ? base : `${base}/${slug}`,
      top: first.top,
      headings: mapFrameworks((framework) => pages[framework].headings),
    });
  }

  return items.sort((a, b) => a.title.localeCompare(b.title));
}

export function componentsNav(options: { dir: string; base?: string; api: Record<FrameworkId, ApiReferenceOptions> }): Plugin {
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
      const api: ApiParts = mapFrameworks(() => ({}));
      for (const framework of FRAMEWORK_IDS) api[framework] = await collectApi(root, options.api[framework]);
      const tree = await scan(dir, base, api);
      return `export const nav = ${JSON.stringify(tree)};\nexport default nav;`;
    },
    handleHotUpdate({ file, server }) {
      const dir = join(root, options.dir);
      // The nav is built from the MDX pages only; demo edits hot-update on their own.
      if (relative(dir, file).startsWith("..") || extname(file) !== ".mdx") return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: "full-reload" });
    },
  };
}
