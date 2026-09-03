import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY_NAME = process.argv[2] ?? "collapsible";
const ENTRY = resolve(PACKAGE_ROOT, "dist", ENTRY_NAME, "index.js");

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g;

async function resolveSpecifier(specifier, importer) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = resolve(dirname(importer), specifier);
  const candidates = base.endsWith(".js") ? [base] : [`${base}.js`, resolve(base, "index.js")];

  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

const seen = new Set();
const sources = [];

async function walk(file) {
  if (seen.has(file)) {
    return;
  }
  seen.add(file);

  const source = await readFile(file, "utf8");
  sources.push(source);

  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1] ?? match[2];
    const resolved = await resolveSpecifier(specifier, file);
    if (resolved) {
      await walk(resolved);
    }
  }
}

await walk(ENTRY);

const combined = sources.join("\n");

console.log(
  JSON.stringify({
    entry: ENTRY_NAME,
    raw: Buffer.byteLength(combined),
    gzip: gzipSync(combined, { level: 9 }).byteLength,
    files: [...seen].map((file) => relative(PACKAGE_ROOT, file).replaceAll("\\", "/")).sort(),
  }),
);
