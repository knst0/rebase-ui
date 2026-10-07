import type { Element as HastElement, Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";

export type RehypeBaseLinksOptions = {
  basePath?: string;
};

type UnifiedPlugin = () => (tree: HastRoot) => undefined;

export function rehypeBaseLinks(options: RehypeBaseLinksOptions = {}): UnifiedPlugin {
  const basePath = options.basePath ?? "";
  const transform = (tree: HastRoot): undefined => {
    if (basePath === "") return;
    visit(tree, "element", (node: HastElement) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string" || !href.startsWith("/")) return;
      node.properties = { ...node.properties, href: `${basePath}${href}` };
    });
  };
  return () => transform;
}
