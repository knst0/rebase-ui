import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Plugin } from "vite";

import { collectApi, type ApiReferenceOptions } from "./apiReference";
import { apiToMarkdown } from "./apiToMarkdown";
import { collectDemo } from "./demos";
import { parseFrontmatter } from "./frontmatter";

const DEMO_TAG = /<Demo\s+([^>]*?)\/>/g;
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
const LINK = /\(\/components\/([a-z0-9-]+)\/?\)/g;

function demoTagName(attributes: string): string | undefined {
  const explicit = /name="([^"]+)"/.exec(attributes)?.[1];
  if (explicit !== undefined) return explicit;
  return /^([A-Za-z0-9_-]+)/.exec(attributes.trim())?.[1];
}

function demoMarkdown(demo: Awaited<ReturnType<typeof collectDemo>>): string {
  if (demo === undefined) return "";

  return demo.variants
    .flatMap((variant) => {
      const title = demo.variants.length > 1 ? `### ${variant.title}\n\n` : "";
      const files = variant.files.map((file) => "```" + file.language + "\n" + file.value + "\n```").join("\n\n");
      return title + files;
    })
    .join("\n\n");
}

async function expandBody(source: string, mdxFile: string): Promise<string> {
  let body = source.replace(FRONTMATTER, "");

  const demoMatches = [...body.matchAll(DEMO_TAG)];
  for (const match of demoMatches) {
    const name = demoTagName(match[1]);
    const markdown = name === undefined ? "" : demoMarkdown(await collectDemo(mdxFile, name));
    body = body.replace(match[0], markdown);
  }

  body = body.replace(LINK, (_, slug: string) => `(/components/${slug}.md)`);

  return body.trim();
}

export type LlmsOptions = {
  componentsDir: string;
  api: ApiReferenceOptions;
};

export function llms(options: LlmsOptions): Plugin {
  let root = process.cwd();

  return {
    name: "llms",
    configResolved(config) {
      root = config.root;
    },
    async generateBundle() {
      if (typeof process === "undefined" || process.env.NODE_ENV !== "development") return;
      const api = await collectApi(root, options.api);
      const dir = join(root, options.componentsDir);
      const entries = await readdir(dir, { withFileTypes: true });
      const index: { slug: string; title: string; description?: string }[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const slug = entry.name;
        const component = api[slug];
        if (component === undefined) continue;

        const mdxFile = join(dir, slug, "index.mdx");
        const source = await readFile(mdxFile, "utf8");
        const page = parseFrontmatter(source, mdxFile);
        const body = await expandBody(source, mdxFile);

        const markdown = apiToMarkdown(component, page, []) + "\n" + body + "\n";

        this.emitFile({ type: "asset", fileName: `components/${slug}.md`, source: markdown });
        index.push({ slug, title: page.title, description: page.description });
      }

      const lines = [
        "# Rebase UI",
        "",
        ...index.map((item) => `- [${item.title}](/components/${item.slug}.md)${item.description ? ` — ${item.description}` : ""}`),
      ];

      this.emitFile({ type: "asset", fileName: "llms.txt", source: lines.join("\n") + "\n" });
    },
  };
}
