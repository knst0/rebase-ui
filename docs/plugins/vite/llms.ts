import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import type { Plugin } from "vite";

import { collectApi } from "../content/api/collect";
import { apiToMarkdown } from "../content/api/toMarkdown";
import type { ApiReferenceOptions } from "../content/api/types";
import { collectDemo, demoToMarkdown } from "../content/demos";
import { parseFrontmatter, stripFrontmatter } from "../content/frontmatter";
import {
  FRAMEWORK_IDS,
  FRAMEWORK_NAMES,
  FRAMEWORK_PACKAGES,
  localize,
  selectFrameworkBlocks,
  type FrameworkId,
} from "../shared/frameworks";

const DEMO_TAG = /<Demo\s+([^>]*?)\/>/g;
const LINK = /\(\/components\/([a-z0-9-]+)(#[a-z0-9-]+)?\/?\)/g;
const PAGE_PATH = /^\/([a-z]+)\/components\/([a-z0-9-]+)\.md$/;
const INDEX_PATH = /^\/(?:([a-z]+)\/)?llms\.txt$/;

function intro(framework: FrameworkId): string {
  return [
    `This is the documentation for the \`${FRAMEWORK_PACKAGES[framework]}\` package.`,
    `It contains a collection of headless components and utilities for building user interfaces in ${FRAMEWORK_NAMES[framework]}.`,
    "The library is designed to be composable and styling agnostic.",
    "The Tailwind CSS examples are written for Tailwind CSS v4. If `package.json` uses Tailwind CSS v3, automatically convert unsupported styles to v3-compatible equivalents.",
  ].join("\n");
}

export type LlmsOptions = {
  componentsDir: string;
  api: Record<FrameworkId, ApiReferenceOptions>;
  /** Deployed base path: "" or "/prefix" without a trailing slash. */
  basePath: string;
  /** Deployed site origin, e.g. "https://rebase.ui.knst.dev". Links fall back to base-path-relative URLs when omitted. */
  siteUrl?: string;
};

type Artifacts = {
  index: string;
  pages: Map<string, string>;
};

function siteUrl(options: LlmsOptions, path: string): string {
  return options.siteUrl === undefined ? `${options.basePath}${path}` : `${options.siteUrl}${options.basePath}${path}`;
}

function demoTagName(attributes: string): string | undefined {
  const explicit = /name="([^"]+)"/.exec(attributes)?.[1];
  if (explicit !== undefined) return explicit;
  return /^([A-Za-z0-9_-]+)/.exec(attributes.trim())?.[1];
}

async function expandBody(source: string, mdxFile: string, options: LlmsOptions, framework: FrameworkId): Promise<string> {
  let body = localize(selectFrameworkBlocks(stripFrontmatter(source, { trailingNewline: true }), framework), framework);

  const demoMatches = [...body.matchAll(DEMO_TAG)];
  for (const match of demoMatches) {
    const name = demoTagName(match[1]);
    const demo = name === undefined ? undefined : await collectDemo(mdxFile, name, framework);
    body = body.replace(match[0], demo === undefined ? "" : demoToMarkdown(demo));
  }

  body = body.replace(
    LINK,
    (_, slug: string, fragment?: string) => `(${options.basePath}/${framework}/components/${slug}.md${fragment ?? ""})`,
  );

  return body.trim();
}

async function generateArtifacts(root: string, options: LlmsOptions, framework: FrameworkId): Promise<Artifacts> {
  const api = await collectApi(root, options.api[framework]);
  const dir = join(root, options.componentsDir);
  const entries = await readdir(dir, { withFileTypes: true });
  const slugs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const pages = new Map<string, string>();
  const items: { slug: string; title: string; description?: string }[] = [];

  for (const slug of slugs) {
    const component = api[slug];
    if (component === undefined) continue;

    const mdxFile = join(dir, slug, "index.mdx");
    const source = await readFile(mdxFile, "utf8");
    const meta = parseFrontmatter(source, mdxFile);
    const page = { ...meta, description: meta.description === undefined ? undefined : localize(meta.description, framework) };
    const body = await expandBody(source, mdxFile, options, framework);

    pages.set(slug, apiToMarkdown(component, page, []) + "\n" + body + "\n");
    items.push({ slug, title: page.title, description: page.description });
  }

  const lines = [
    `# Rebase UI for ${FRAMEWORK_NAMES[framework]}`,
    "",
    intro(framework),
    "",
    "## Components",
    "",
    ...items.map(
      (item) =>
        `- [${item.title}](${siteUrl(options, `/${framework}/components/${item.slug}.md`)})${item.description === undefined ? "" : `: ${item.description}`}`,
    ),
  ];

  return { index: lines.join("\n") + "\n", pages };
}

/** Root `llms.txt`: one entry per framework package. */
function rootIndex(options: LlmsOptions): string {
  const lines = [
    "# Rebase UI",
    "",
    "Headless, accessible UI components ported from Base UI. Each framework has its own package and documentation:",
    "",
    ...FRAMEWORK_IDS.map(
      (framework) =>
        `- [${FRAMEWORK_NAMES[framework]}](${siteUrl(options, `/${framework}/llms.txt`)}): \`${FRAMEWORK_PACKAGES[framework]}\``,
    ),
  ];
  return lines.join("\n") + "\n";
}

function isFramework(value: string | undefined): value is FrameworkId {
  return (FRAMEWORK_IDS as readonly (string | undefined)[]).includes(value);
}

export function llms(options: LlmsOptions): Plugin {
  let root = process.cwd();

  return {
    name: "llms",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const raw = new URL(req.url ?? "/", "http://localhost").pathname;
        const pathname = options.basePath !== "" && raw.startsWith(`${options.basePath}/`) ? raw.slice(options.basePath.length) : raw;

        try {
          const index = INDEX_PATH.exec(pathname);
          if (index !== null && (index[1] === undefined || isFramework(index[1]))) {
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(index[1] === undefined ? rootIndex(options) : (await generateArtifacts(root, options, index[1])).index);
            return;
          }

          const page = PAGE_PATH.exec(pathname);
          if (page !== null && isFramework(page[1])) {
            const { pages } = await generateArtifacts(root, options, page[1]);
            const markdown = pages.get(page[2]);
            if (markdown !== undefined) {
              res.setHeader("Content-Type", "text/markdown; charset=utf-8");
              res.end(markdown);
              return;
            }
          }
        } catch (error) {
          next(error);
          return;
        }

        next();
      });
    },
    async generateBundle() {
      this.emitFile({ type: "asset", fileName: "llms.txt", source: rootIndex(options) });
      for (const framework of FRAMEWORK_IDS) {
        const { index, pages } = await generateArtifacts(root, options, framework);
        this.emitFile({ type: "asset", fileName: `${framework}/llms.txt`, source: index });
        for (const [slug, source] of pages) {
          this.emitFile({ type: "asset", fileName: `${framework}/components/${slug}.md`, source });
        }
      }
    },
  };
}
