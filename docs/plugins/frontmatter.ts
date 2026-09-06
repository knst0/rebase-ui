import { parse } from "yaml";

export type SectionId = "demo" | "api" | "types";

export type PageMeta = {
  title: string;
  subtitle?: string;
  description?: string;
  sections: SectionId[];
};

const SECTION_IDS: SectionId[] = ["demo", "api", "types"];
const DEFAULT_SECTIONS: SectionId[] = ["api"];
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as string[]).includes(value);
}

export function parseFrontmatter(source: string, filePath: string): PageMeta {
  const match = FRONTMATTER.exec(source);
  if (match === null) {
    throw new Error(`Missing frontmatter in ${filePath}`);
  }

  const data = (parse(match[1]) ?? {}) as Record<string, unknown>;

  if (typeof data.title !== "string" || data.title.trim() === "") {
    throw new Error(`Missing frontmatter "title" in ${filePath}`);
  }

  let sections = DEFAULT_SECTIONS;
  if (data.sections !== undefined) {
    if (!Array.isArray(data.sections)) {
      throw new TypeError(`Frontmatter "sections" must be an array in ${filePath}`);
    }
    sections = data.sections.map((id) => {
      if (typeof id !== "string" || !isSectionId(id)) {
        throw new Error(`Unknown section id "${String(id)}" in ${filePath}`);
      }
      return id;
    });
  }

  return {
    title: data.title,
    subtitle: typeof data.subtitle === "string" ? data.subtitle : undefined,
    description: typeof data.description === "string" ? data.description : undefined,
    sections,
  };
}
