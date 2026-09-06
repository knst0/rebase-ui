import type { Element as HastElement, Root as HastRoot, RootContent as HastContent } from "hast";

export function hastText(node: HastContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(hastText).join("");
  return "";
}

export function headingDepth(node: HastContent): number | undefined {
  if (node.type !== "element") return undefined;
  const match = /^h([1-6])$/.exec(node.tagName);
  return match ? Number(match[1]) : undefined;
}

export function isElement(node: HastContent, tagName: string): node is HastElement {
  return node.type === "element" && node.tagName === tagName;
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

function attributeValue(value: unknown) {
  if (typeof value === "string") return value;
  return {
    type: "mdxJsxAttributeValueExpression",
    value: JSON.stringify(value),
    data: {
      estree: {
        type: "Program",
        sourceType: "module",
        comments: [],
        body: [{ type: "ExpressionStatement", expression: jsonToEstree(value) }],
      },
    },
  };
}

export function mdxJsx(name: string, props: Record<string, unknown>): HastContent {
  return {
    type: "mdxJsxFlowElement",
    name,
    attributes: Object.entries(props)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({ type: "mdxJsxAttribute", name: key, value: attributeValue(value) })),
    children: [],
  } as unknown as HastContent;
}

export type { HastRoot, HastContent, HastElement };
