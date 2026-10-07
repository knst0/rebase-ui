export { apiReference } from "./vite/apiReference";
export { componentsNav, type NavHeading, type NavItem } from "./vite/componentsNav";
export { llms, type LlmsOptions } from "./vite/llms";

export { rehypeBaseLinks, type RehypeBaseLinksOptions } from "./mdx/rehypeBaseLinks";
export { rehypeCodeValue, type RehypeCodeValuePreProps } from "./mdx/rehypeCodeValue";
export { rehypeDemo, type RehypeDemoOptions, type DemoVFile } from "./mdx/rehypeDemo";
export { rehypeReference, type ReferenceKind, type ReferenceRow } from "./mdx/rehypeReference";
export { rehypeSections, type RehypeSectionsOptions } from "./mdx/rehypeSections";
export { highlightCode, type HighlightCodeOptions } from "./mdx/highlightCode";

export { DEMOS_DIR, type Demo, type DemoVariant, type DemoFile } from "./content/demos";
export { parseFrontmatter, stripFrontmatter, type PageMeta, type SectionId } from "./content/frontmatter";

export { collectApi } from "./content/api/collect";
export { apiToMarkdown } from "./content/api/toMarkdown";
export type { ApiComponent, ApiProp, ApiAttribute, ApiType, ApiPart, ApiExportGroup, ApiReferenceOptions } from "./content/api/types";
