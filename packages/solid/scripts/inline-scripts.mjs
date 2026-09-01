import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { minifySync } from "oxc-minify";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(CURRENT_DIR, "..", "src");
const TEMPLATE_NAME = "prehydrationScript.template.js";
const MIN_NAME = "prehydrationScript.min.ts";

function findTemplateFiles(dir, matches = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      findTemplateFiles(fullPath, matches);
    } else if (entry.name === TEMPLATE_NAME) {
      matches.push(fullPath);
    }
  }
  return matches;
}

const templates = findTemplateFiles(SOURCE_DIR);

if (templates.length === 0) {
  console.log(`No ${TEMPLATE_NAME} files found under ${SOURCE_DIR}`);
  process.exit(0);
}

let failed = false;

for (const templatePath of templates) {
  const source = readFileSync(templatePath, "utf8");
  const { code, errors } = minifySync(templatePath, source, { compress: true, mangle: true });

  const fatalErrors = errors.filter((e) => e.severity === "Error");

  if (fatalErrors.length) {
    fatalErrors.forEach((e) => console.error(`[${relative(SOURCE_DIR, templatePath)}] ${e.codeframe ?? e.message}`));
    failed = true;
    continue;
  }

  const escaped = code.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r?\n/g, "");
  const output = `// oxfmt-ignore \nexport const script = '${escaped}';\n`;
  const minPath = join(dirname(templatePath), MIN_NAME);

  writeFileSync(minPath, output);
  console.log(`Wrote ${relative(SOURCE_DIR, minPath)} (${output.length} bytes)`);
}

if (failed) process.exit(1);
