import { basename, dirname } from "node:path";

import { parseFrontmatter, type SectionId } from "../content/frontmatter";
import { mdxJsxElement, type HastContent, type HastRoot } from "../shared/hast";
import type { DemoVFile } from "./rehypeDemo";

type SectionsTransformer = (tree: HastRoot, file: DemoVFile) => undefined;

type UnifiedPlugin = () => SectionsTransformer;

const COMPONENT_FOR_SECTION: Partial<Record<SectionId, string>> = {
  api: "ApiReference",
};

type JsxNode = {
  type?: string;
  name?: string | null;
  attributes?: { type?: string; name?: string }[];
};

function isJsxElement(node: HastContent, name: string): boolean {
  const candidate = node as unknown as JsxNode;
  return (candidate.type === "mdxJsxFlowElement" || candidate.type === "mdxJsxTextElement") && candidate.name === name;
}

function fillSlug(node: HastContent, slug: string): void {
  const candidate = node as unknown as Required<Pick<JsxNode, "attributes">>;
  candidate.attributes ??= [];
  if (candidate.attributes.some((attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === "slug")) return;
  const [filled] = (mdxJsxElement("x", { slug }) as unknown as Required<Pick<JsxNode, "attributes">>).attributes;
  candidate.attributes.push(filled);
}

function titleNode(title: string): HastContent {
  return {
    type: "mdxJsxFlowElement",
    name: "Title",
    attributes: [],
    children: [{ type: "text", value: title }],
  } as unknown as HastContent;
}

export type RehypeSectionsOptions = {
  siteName?: string;
};

export function rehypeSections(options: RehypeSectionsOptions = {}): UnifiedPlugin {
  const transform: SectionsTransformer = (tree, file) => {
    const mdxFile = file.path ?? file.history?.[0];
    if (mdxFile === undefined || typeof file.value !== "string") return;

    const meta = parseFrontmatter(file.value, mdxFile);
    const slug = basename(dirname(mdxFile));

    const title = options.siteName === undefined ? meta.title : `${meta.title} – ${options.siteName}`;
    const head: HastContent[] = [titleNode(title)];
    if (meta.description !== undefined)
      head.push(mdxJsxElement("Meta", { name: "description", content: meta.description }) as unknown as HastContent);

    tree.children.unshift(...head);

    for (const section of meta.sections) {
      const name = COMPONENT_FOR_SECTION[section];
      if (name === undefined) continue;
      const existing = tree.children.find((node) => isJsxElement(node, name));
      if (existing !== undefined) {
        fillSlug(existing, slug);
        continue;
      }
      tree.children.push(mdxJsxElement(name, { slug }) as unknown as HastContent);
    }
  };

  return () => transform;
}
