import type { Element as HastElement, Root as HastRoot } from "hast";
import { SKIP, visit } from "unist-util-visit";

import { hastText } from "../shared/hast";

function hastLanguage(node: HastElement): string | undefined {
  const className: unknown = node.properties?.class;
  const names = Array.isArray(className) ? className : typeof className === "string" ? className.split(" ") : [];
  for (const name of names) {
    if (typeof name === "string" && name.startsWith("language-")) return name.slice("language-".length);
  }
}

const META_ATTRIBUTE = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;

function hastMeta(node: HastElement): Record<string, string> {
  const meta = (node.data as { meta?: unknown } | undefined)?.meta;
  if (typeof meta !== "string") return {};
  return Object.fromEntries(
    [...meta.matchAll(META_ATTRIBUTE)].map(([, key, quoted, single, bare]) => [key, quoted ?? single ?? bare ?? "true"]),
  );
}

export function rehypeCodeValue() {
  return (tree: HastRoot) => {
    // `visit` also descends into MDX JSX elements, so fences inside `<Framework only>` blocks get their value.
    visit(tree, "element", (node: HastElement) => {
      const [first] = node.children;
      if (node.tagName !== "pre" || first?.type !== "element" || first.tagName !== "code") return;
      node.properties = {
        ...node.properties,
        ...hastMeta(first),
        value: hastText(first),
        language: hastLanguage(first),
      };
      return SKIP;
    });
  };
}

export type RehypeCodeValuePreProps = {
  language?: string;
  value?: string;
};
