import type { Element as HastElement, Root as HastRoot, RootContent as HastContent } from "hast";

export function hastText(node: HastContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(hastText).join("");
  return "";
}

export function jsonToEstree(value: unknown): Record<string, unknown> {
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

function expressionAttributeValue(value: unknown) {
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

function rawAttributeValue(value: unknown) {
  if (typeof value === "string") return value;
  return expressionAttributeValue(value);
}

export function mdxJsxElement(name: string, props: Record<string, unknown>): HastContent {
  return {
    type: "mdxJsxFlowElement",
    name,
    attributes: Object.entries(props)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({ type: "mdxJsxAttribute", name: key, value: rawAttributeValue(value) })),
    children: [],
  } as unknown as HastContent;
}

export function mdxJsxDataElement(name: string, props: Record<string, unknown>): HastContent {
  return {
    type: "mdxJsxFlowElement",
    name,
    attributes: Object.entries(props).map(([key, value]) => ({
      type: "mdxJsxAttribute",
      name: key,
      value: expressionAttributeValue(value),
    })),
    children: [],
  } as unknown as HastContent;
}

/** `{ key: [() => import("spec"), …], … }` as a JSX attribute value: lazily loaded modules per key. */
export function importLoadersExpression(specifiers: Record<string, string[]>): unknown {
  const loader = (specifier: string) => ({
    type: "ArrowFunctionExpression",
    params: [],
    async: false,
    generator: false,
    expression: true,
    body: { type: "ImportExpression", source: { type: "Literal", value: specifier, raw: JSON.stringify(specifier) } },
  });
  const value = `{ ${Object.entries(specifiers)
    .map(([key, list]) => `${JSON.stringify(key)}: [${list.map((specifier) => `() => import(${JSON.stringify(specifier)})`).join(", ")}]`)
    .join(", ")} }`;
  return {
    type: "mdxJsxAttributeValueExpression",
    value,
    data: {
      estree: {
        type: "Program",
        sourceType: "module",
        comments: [],
        body: [
          {
            type: "ExpressionStatement",
            expression: {
              type: "ObjectExpression",
              properties: Object.entries(specifiers).map(([key, list]) => ({
                type: "Property",
                key: { type: "Literal", value: key, raw: JSON.stringify(key) },
                value: { type: "ArrayExpression", elements: list.map(loader) },
                kind: "init",
                method: false,
                shorthand: false,
                computed: false,
              })),
            },
          },
        ],
      },
    },
  };
}

export type { HastRoot, HastContent, HastElement };
