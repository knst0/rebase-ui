import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import type { Plugin } from "vite";

import { collectApi } from "../content/api/collect";
import { apiToMarkdown } from "../content/api/toMarkdown";
import type { ApiReferenceOptions } from "../content/api/types";
import { collectDemo, demoToMarkdown } from "../content/demos";
import { parseFrontmatter, stripFrontmatter } from "../content/frontmatter";

const DEMO_TAG = /<Demo\s+([^>]*?)\/>/g;
const LINK = /\(\/components\/([a-z0-9-]+)(#[a-z0-9-]+)?\/?\)/g;
const PAGE_PATH = /^\/components\/([a-z0-9-]+)\.md$/;

const INTRO = [
  "This is the documentation for the `@rebase-ui/solid` package.",
  "It contains a collection of headless components and utilities for building user interfaces in Solid JS.",
  "The library is designed to be composable and styling agnostic.",
  "The Tailwind CSS examples are written for Tailwind CSS v4. If `package.json` uses Tailwind CSS v3, automatically convert unsupported styles to v3-compatible equivalents.",
].join("\n");

export type LlmsOptions = {
  componentsDir: string;
  api: ApiReferenceOptions;
  /** Deployed base path: "" or "/prefix" without a trailing slash. */
  basePath: string;
  /** Deployed site origin, e.g. "https://rebase.ui.knst.dev". Links fall back to base-path-relative URLs when omitted. */
  siteUrl?: string;
};

type Artifacts = {
  index: string;
  pages: Map<string, string>;
};

function pageUrl(options: LlmsOptions, slug: string): string {
  const path = `${options.basePath}/components/${slug}.md`;
  return options.siteUrl === undefined ? path : `${options.siteUrl}${path}`;
}

function demoTagName(attributes: string): string | undefined {
  const explicit = /name="([^"]+)"/.exec(attributes)?.[1];
  if (explicit !== undefined) return explicit;
  return /^([A-Za-z0-9_-]+)/.exec(attributes.trim())?.[1];
}

async function expandBody(source: string, mdxFile: string, options: LlmsOptions): Promise<string> {
  let body = stripFrontmatter(source, { trailingNewline: true });

  const demoMatches = [...body.matchAll(DEMO_TAG)];
  for (const match of demoMatches) {
    const name = demoTagName(match[1]);
    const demo = name === undefined ? undefined : await collectDemo(mdxFile, name);
    body = body.replace(match[0], demo === undefined ? "" : demoToMarkdown(demo));
  }

  body = body.replace(LINK, (_, slug: string, fragment?: string) => `(${options.basePath}/components/${slug}.md${fragment ?? ""})`);

  return body.trim();
}

async function generateArtifacts(root: string, options: LlmsOptions): Promise<Artifacts> {
  const api = await collectApi(root, options.api);
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
    const page = parseFrontmatter(source, mdxFile);
    const body = await expandBody(source, mdxFile, options);

    pages.set(slug, apiToMarkdown(component, page, []) + "\n" + body + "\n");
    items.push({ slug, title: page.title, description: page.description });
  }

  const lines = [
    "# Rebase UI",
    "",
    INTRO,
    "",
    "## Components",
    "",
    ...items.map(
      (item) => `- [${item.title}](${pageUrl(options, item.slug)})${item.description === undefined ? "" : `: ${item.description}`}`,
    ),
  ];

  return { index: lines.join("\n") + "\n", pages };
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
          if (pathname === "/llms.txt") {
            const { index } = await generateArtifacts(root, options);
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(index);
            return;
          }

          const page = PAGE_PATH.exec(pathname);
          if (page !== null) {
            const { pages } = await generateArtifacts(root, options);
            const markdown = pages.get(page[1]);
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
      const { index, pages } = await generateArtifacts(root, options);
      this.emitFile({ type: "asset", fileName: "llms.txt", source: index });
      for (const [slug, source] of pages) {
        this.emitFile({ type: "asset", fileName: `components/${slug}.md`, source });
      }
    },
  };
}
