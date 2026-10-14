export const FRAMEWORK_IDS = ["solid", "reze"] as const;

export type FrameworkId = (typeof FRAMEWORK_IDS)[number];

/** Builds a `Record` with one entry per framework. */
export function mapFrameworks<T>(value: (framework: FrameworkId) => T): Record<FrameworkId, T> {
  return Object.fromEntries(FRAMEWORK_IDS.map((framework) => [framework, value(framework)])) as Record<FrameworkId, T>;
}

export const FRAMEWORK_NAMES: Record<FrameworkId, string> = {
  solid: "Solid.js",
  reze: "Reze.js",
};

export const FRAMEWORK_PACKAGES: Record<FrameworkId, string> = {
  solid: "@rebase-ui/solid",
  reze: "@rebase-ui/reze",
};

/** Placeholder for the framework name in frontmatter descriptions and prose shared by every framework. */
const FRAMEWORK_TOKEN = /\{framework\}/g;

/** Package specifier the shared docs are written against; rewritten to the framework being shown. */
const SHARED_PACKAGE = /@rebase-ui\/solid\b/g;

/** Rewrites framework-agnostic docs text (code samples, descriptions) for `framework`. */
export function localize(text: string, framework: FrameworkId): string {
  return text.replace(FRAMEWORK_TOKEN, FRAMEWORK_NAMES[framework]).replace(SHARED_PACKAGE, FRAMEWORK_PACKAGES[framework]);
}

/** `<Framework only="reze">…</Framework>` blocks: content shown for one framework only. */
const FRAMEWORK_BLOCK = /<Framework\s+only="([a-z]+)"\s*>\r?\n?([\s\S]*?)<\/Framework>/g;

/** Keeps the `<Framework only>` blocks of `framework` (unwrapped) and drops the others, for plain-markdown output. */
export function selectFrameworkBlocks(source: string, framework: FrameworkId): string {
  return source.replace(FRAMEWORK_BLOCK, (_, only: string, body: string) => (only === framework ? body : ""));
}
