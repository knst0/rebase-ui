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

export function mdxjsEsmImport(name: string, from: string): HastContent {
  return {
    type: "mdxjsEsm",
    value: `import ${name} from ${JSON.stringify(from)};`,
    data: {
      estree: {
        type: "Program",
        sourceType: "module",
        comments: [],
        body: [
          {
            type: "ImportDeclaration",
            specifiers: [{ type: "ImportDefaultSpecifier", local: { type: "Identifier", name } }],
            source: { type: "Literal", value: from, raw: JSON.stringify(from) },
            attributes: [],
          },
        ],
      },
    },
  } as unknown as HastContent;
}

export function identifierArrayExpression(names: string[]): unknown {
  return {
    type: "mdxJsxAttributeValueExpression",
    value: `[${names.join(", ")}]`,
    data: {
      estree: {
        type: "Program",
        sourceType: "module",
        comments: [],
        body: [
          {
            type: "ExpressionStatement",
            expression: {
              type: "ArrayExpression",
              elements: names.map((name) => ({ type: "Identifier", name })),
            },
          },
        ],
      },
    },
  };
}

export type { HastRoot, HastContent, HastElement };
