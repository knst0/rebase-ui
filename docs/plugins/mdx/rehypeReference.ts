import type { Element as HastElement, Root as HastRoot, RootContent as HastContent } from "hast";

import { hastText, mdxJsxDataElement } from "../shared/hast";

export type ReferenceKind = "props" | "attributes" | "css-variables";

export type ReferenceRow = {
  name: string;
  type?: string;
  default?: string;
  description: string;
};

const CAPTION = /^(.*?)\s+(Props|Data Attributes|CSS Variables)\s*:?\s*$/i;

const KIND: Record<string, ReferenceKind> = {
  props: "props",
  "data attributes": "attributes",
  "css variables": "css-variables",
};

function inlineHtml(node: HastContent): string {
  if (node.type === "text") return escapeInline(node.value);
  if (node.type !== "element") return "";
  const inner = node.children.map(inlineHtml).join("");
  if (node.tagName === "code") return `<code>${inner}</code>`;
  if (node.tagName === "a") {
    const href = String(node.properties?.href ?? "");
    return `<a href="${escapeInline(href)}">${inner}</a>`;
  }
  if (node.tagName === "strong" || node.tagName === "b") return `<strong>${inner}</strong>`;
  if (node.tagName === "em" || node.tagName === "i") return `<em>${inner}</em>`;
  if (node.tagName === "br") return "<br />";
  return inner;
}

function escapeInline(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r?\n/g, "<br />");
}

function elements(node: HastElement, tagName: string): HastElement[] {
  return node.children.filter((child): child is HastElement => child.type === "element" && child.tagName === tagName);
}

function rows(table: HastElement): ReferenceRow[] {
  const head = elements(table, "thead")[0];
  const body = elements(table, "tbody")[0];
  const headers = head ? elements(elements(head, "tr")[0] ?? head, "th").map((cell) => hastText(cell).trim().toLowerCase()) : [];

  const parsed: ReferenceRow[] = [];
  for (const tr of body ? elements(body, "tr") : []) {
    const cells = elements(tr, "td");
    const row: Record<string, string> = {};
    cells.forEach((cell, index) => {
      const key = headers[index] ?? String(index);
      row[key] = key === "description" ? cell.children.map(inlineHtml).join("").trim() : hastText(cell).trim();
    });
    const name = row.prop ?? row.attribute ?? row.variable ?? row.name ?? "";
    if (name === "") continue;
    parsed.push({
      name,
      type: normalize(row.type),
      default: normalize(row.default),
      description: row.description ?? "",
    });
  }

  return parsed;
}

function normalize(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "—") return undefined;
  return trimmed.replace(/^`|`$/g, "").replace(/&#xA;/g, " ").replace(/\s+/g, " ");
}

export function rehypeReference() {
  return (tree: HastRoot) => {
    const children = tree.children;
    const next: HastContent[] = [];

    for (let index = 0; index < children.length; index += 1) {
      const node = children[index];
      const caption = captionOf(node);

      if (caption) {
        const table = findTable(children, index + 1);
        if (table) {
          next.push(mdxJsxDataElement("ReferenceTable", { name: caption.name, rows: rows(table.node) }));
          index = table.index;
          continue;
        }
      }

      if (node.type === "element" && node.tagName === "table") {
        next.push(mdxJsxDataElement("ReferenceTable", { rows: rows(node) }));
        continue;
      }

      next.push(node);
    }

    tree.children = next;
  };
}

function captionOf(node: HastContent): { name: string } | undefined {
  if (node.type !== "element" || node.tagName !== "p") return;
  const only = node.children.find((child) => child.type !== "text" || child.value.trim() !== "");
  if (only?.type !== "element" || only.tagName !== "strong") return;
  const match = CAPTION.exec(hastText(only).trim());
  if (!match) return;
  const kind = KIND[match[2].toLowerCase()];
  if (!kind) return;
  return { name: match[1].trim() };
}

function findTable(children: HastContent[], from: number): { node: HastElement; index: number } | undefined {
  for (let index = from; index < children.length; index += 1) {
    const node = children[index];
    if (node.type === "text" && node.value.trim() === "") continue;
    if (node.type === "element" && node.tagName === "table") return { node, index };
    return undefined;
  }
}
