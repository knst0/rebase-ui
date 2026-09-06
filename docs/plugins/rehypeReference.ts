import type { Element as HastElement, Root as HastRoot, RootContent as HastContent } from "hast";

function mdxJsx(name: string, props: Record<string, unknown>): HastContent {
  return {
    type: "mdxJsxFlowElement",
    name,
    attributes: Object.entries(props).map(([key, value]) => ({
      type: "mdxJsxAttribute",
      name: key,
      value: {
        type: "mdxJsxAttributeValueExpression",
        value: JSON.stringify(value),
        data: {
          estree: {
            type: "Program",
            sourceType: "module",
            comments: [],
            body: [
              {
                type: "ExpressionStatement",
                expression: jsonToEstree(value),
              },
            ],
          },
        },
      },
    })),
    children: [],
  } as unknown as HastContent;
}

function jsonToEstree(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return { type: "ArrayExpression", elements: value.map(jsonToEstree) };
  }
  if (value === null) return { type: "Literal", value: null, raw: "null" };
  if (typeof value === "object") {
    return {
      type: "ObjectExpression",
      properties: Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => ({
          type: "Property",
          kind: "init",
          method: false,
          shorthand: false,
          computed: false,
          key: { type: "Literal", value: key, raw: JSON.stringify(key) },
          value: jsonToEstree(item),
        })),
    };
  }
  return { type: "Literal", value, raw: JSON.stringify(value) };
}

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

function text(node: HastContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(text).join("");
  return "";
}

function html(node: HastContent): string {
  if (node.type === "text") return escape(node.value);
  if (node.type !== "element") return "";
  const inner = node.children.map(html).join("");
  if (node.tagName === "code") return `<code>${inner}</code>`;
  if (node.tagName === "a") {
    const href = String(node.properties?.href ?? "");
    return `<a href="${escape(href)}">${inner}</a>`;
  }
  if (node.tagName === "strong" || node.tagName === "b") return `<strong>${inner}</strong>`;
  if (node.tagName === "em" || node.tagName === "i") return `<em>${inner}</em>`;
  if (node.tagName === "br") return "<br />";
  return inner;
}

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r?\n/g, "<br />");
}

function elements(node: HastElement, tagName: string): HastElement[] {
  return node.children.filter((child): child is HastElement => child.type === "element" && child.tagName === tagName);
}

function rows(table: HastElement): { headers: string[]; rows: ReferenceRow[] } {
  const head = elements(table, "thead")[0];
  const body = elements(table, "tbody")[0];
  const headers = head ? elements(elements(head, "tr")[0] ?? head, "th").map((cell) => text(cell).trim().toLowerCase()) : [];

  const parsed: ReferenceRow[] = [];
  for (const tr of body ? elements(body, "tr") : []) {
    const cells = elements(tr, "td");
    const row: Record<string, string> = {};
    cells.forEach((cell, index) => {
      const key = headers[index] ?? String(index);
      row[key] = key === "description" ? cell.children.map(html).join("").trim() : text(cell).trim();
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

  return { headers, rows: parsed };
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
          const { rows: data } = rows(table.node);
          next.push(mdxJsx("ReferenceTable", { name: caption.name, rows: data }));
          index = table.index;
          continue;
        }
      }

      if (node.type === "element" && node.tagName === "table") {
        const { rows: data } = rows(node);
        next.push(mdxJsx("ReferenceTable", { rows: data }));
        continue;
      }

      next.push(node);
    }

    tree.children = next;
  };
}

function captionOf(node: HastContent): { name: string; kind: ReferenceKind } | undefined {
  if (node.type !== "element" || node.tagName !== "p") return;
  const only = node.children.find((child) => child.type !== "text" || child.value.trim() !== "");
  if (only?.type !== "element" || only.tagName !== "strong") return;
  const match = CAPTION.exec(text(only).trim());
  if (!match) return;
  const kind = KIND[match[2].toLowerCase()];
  if (!kind) return;
  return { name: match[1].trim(), kind };
}

function findTable(children: HastContent[], from: number): { node: HastElement; index: number } | undefined {
  for (let index = from; index < children.length; index += 1) {
    const node = children[index];
    if (node.type === "text" && node.value.trim() === "") continue;
    if (node.type === "element" && node.tagName === "table") return { node, index };
    return undefined;
  }
}
