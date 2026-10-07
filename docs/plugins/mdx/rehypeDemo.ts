import { relative } from "node:path";

import { collectDemo, DEMOS_DIR, type Demo, type DemoVariant } from "../content/demos";
import { identifierArrayExpression, mdxJsxElement, mdxjsEsmImport, type HastContent, type HastRoot } from "../shared/hast";

type JsxNode = {
  type: "mdxJsxFlowElement";
  name?: string | null;
  attributes: { type: string; name?: string; value?: unknown }[];
};

function isDemo(node: HastContent): node is HastContent & JsxNode {
  const candidate = node as unknown as JsxNode;
  return candidate.type === "mdxJsxFlowElement" && candidate.name === "Demo";
}

function demoName(node: JsxNode): string | undefined {
  let explicit: string | undefined;
  let shorthand: string | undefined;

  for (const attribute of node.attributes) {
    if (attribute.type !== "mdxJsxAttribute" || attribute.name === undefined) continue;
    if (attribute.name === "name" && typeof attribute.value === "string") {
      explicit = attribute.value;
      continue;
    }
    if (attribute.value === null || attribute.value === undefined) shorthand ??= attribute.name;
  }

  return explicit ?? shorthand;
}

function importSpecifier(demo: Demo, variant: DemoVariant): string {
  const entry = variant.files[0].name;
  return demo.nested ? `./${DEMOS_DIR}/${demo.name}/${entry}` : `./${DEMOS_DIR}/${entry}`;
}

function identifier(demoName: string, variantId: string): string {
  const clean = (value: string) =>
    value
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  return `Demo_${clean(demoName)}_${clean(variantId)}`;
}

export type RehypeDemoOptions = {
  cwd?: string;
};

export type DemoVFile = { path?: string; history?: string[]; value?: string };

type DemoTransformer = (tree: HastRoot, file: DemoVFile) => Promise<undefined>;

type UnifiedPlugin = () => DemoTransformer;

export function rehypeDemo(options: RehypeDemoOptions = {}): UnifiedPlugin {
  const transform: DemoTransformer = async (tree, file) => {
    const mdxFile = file.path ?? file.history?.[0];
    if (mdxFile === undefined) return;

    const children = tree.children;
    const next: HastContent[] = [];
    const imports: HastContent[] = [];

    for (const node of children) {
      if (!isDemo(node)) {
        next.push(node);
        continue;
      }

      const name = demoName(node);
      if (name === undefined) {
        throw new Error(`<Demo /> in ${relative(options.cwd ?? process.cwd(), mdxFile)} is missing a demo name.`);
      }

      const demo = await collectDemo(mdxFile, name);
      if (demo === undefined || demo.variants.length === 0) {
        throw new Error(`<Demo ${name} /> in ${relative(options.cwd ?? process.cwd(), mdxFile)} has no source in ${DEMOS_DIR}/${name}.`);
      }

      const identifiers: string[] = [];
      for (const variant of demo.variants) {
        const local = identifier(demo.name, variant.id);
        identifiers.push(local);
        imports.push(mdxjsEsmImport(local, importSpecifier(demo, variant)));
      }

      const element = mdxJsxElement("Demo", {
        name: demo.name,
        variants: demo.variants.map((variant) => ({ id: variant.id, title: variant.title, files: variant.files })),
      }) as unknown as JsxNode;

      element.attributes.push({
        type: "mdxJsxAttribute",
        name: "components",
        value: identifierArrayExpression(identifiers),
      });

      next.push(element as unknown as HastContent);
    }

    tree.children = [...imports, ...next];
  };

  return () => transform;
}
