import type { Element as HastElement, Root as HastRoot } from "hast";

import { hastText } from "../shared/hast";

function hastLanguage(node: HastElement): string | undefined {
  const className: unknown = node.properties?.className;
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
    const walk = (parent: HastRoot | HastElement) => {
      for (const child of parent.children) {
        if (child.type !== "element") continue;
        const [first] = child.children;
        if (child.tagName === "pre" && first?.type === "element" && first.tagName === "code") {
          child.properties = {
            ...child.properties,
            ...hastMeta(first),
            value: hastText(first),
            language: hastLanguage(first),
          };
          continue;
        }
        walk(child);
      }
    };
    walk(tree);
  };
}

export type RehypeCodeValuePreProps = {
  language?: string;
  value?: string;
};
