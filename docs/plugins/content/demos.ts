import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join } from "node:path";

import { titleFromSlug } from "../shared/text";

export const DEMOS_DIR = "_demos";

export type DemoFile = {
  name: string;
  language: string;
  value: string;
};

export type DemoVariant = {
  id: string;
  title: string;
  files: DemoFile[];
};

export type Demo = {
  name: string;
  dir: string;
  nested: boolean;
  variants: DemoVariant[];
};

const ENTRY_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);

const VARIANT_TITLES: Record<string, string> = {
  css: "CSS",
  "css-modules": "CSS Modules",
  tailwind: "Tailwind",
};

function variantTitle(slug: string): string {
  return VARIANT_TITLES[slug] ?? titleFromSlug(slug);
}

function languageOf(file: string): string {
  const extension = extname(file).slice(1);
  return extension === "mjs" || extension === "cjs" ? "js" : extension;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function readVariant(dir: string, entry: string, id: string): Promise<DemoVariant> {
  const source = join(dir, entry);
  const files: DemoFile[] = [];

  files.push({ name: entry, language: languageOf(entry), value: await readFile(source, "utf8") });

  return { id, title: variantTitle(id), files };
}

async function siblingFiles(dir: string, entry: string): Promise<DemoFile[]> {
  const base = entry.slice(0, -extname(entry).length);
  const files: DemoFile[] = [];

  for (const name of await readdir(dir)) {
    if (name === entry) continue;
    if (ENTRY_EXTENSIONS.has(extname(name))) continue;
    if (!name.startsWith(base + ".")) continue;
    files.push({ name, language: languageOf(name), value: await readFile(join(dir, name), "utf8") });
  }

  return files;
}

async function readDirectoryDemo(dir: string, name: string): Promise<Demo | undefined> {
  if (typeof process === "undefined" || process.env.NODE_ENV !== "development") return undefined;
  const entries = await readdir(dir);
  const variants: DemoVariant[] = [];

  for (const entry of entries.sort()) {
    if (!ENTRY_EXTENSIONS.has(extname(entry))) continue;
    const id = entry.slice(0, -extname(entry).length);
    const variant = await readVariant(dir, entry, id);
    variant.files.push(...(await siblingFiles(dir, entry)));
    variants.push(variant);
  }

  return { name, dir, nested: true, variants };
}

export async function collectDemo(mdxFile: string, name: string): Promise<Demo | undefined> {
  const root = join(dirname(mdxFile), DEMOS_DIR);

  const asDirectory = join(root, name);
  if (await isDirectory(asDirectory)) return readDirectoryDemo(asDirectory, name);

  for (const extension of ENTRY_EXTENSIONS) {
    const file = join(root, name + extension);
    try {
      const value = await readFile(file, "utf8");
      const variant: DemoVariant = {
        id: name,
        title: variantTitle(name),
        files: [{ name: name + extension, language: languageOf(file), value }],
      };
      variant.files.push(...(await siblingFiles(root, name + extension)));
      return { name, dir: root, nested: false, variants: [variant] };
    } catch {
      continue;
    }
  }
}

export async function listDemos(mdxFile: string): Promise<string[]> {
  if (typeof process === "undefined" || process.env.NODE_ENV !== "development") return [];
  const root = join(dirname(mdxFile), DEMOS_DIR);
  const names = new Set<string>();

  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        names.add(entry.name);
        continue;
      }
      if (ENTRY_EXTENSIONS.has(extname(entry.name))) names.add(entry.name.slice(0, -extname(entry.name).length));
    }
  } catch {
    return [];
  }

  return [...names].sort();
}

export function demoToMarkdown(demo: Demo): string {
  const blocks = demo.variants.flatMap((variant) => {
    const title = demo.variants.length > 1 ? `### ${variant.title}` : "";
    const files = variant.files.map((file) => "```" + file.language + "\n" + file.value + "\n```").join("\n\n");
    return [title, files].filter(Boolean);
  });

  return blocks.join("\n\n");
}
