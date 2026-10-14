import { dirname, relative } from "node:path";

import { collectDemo, demosDir, type Demo, type DemoVariant } from "../content/demos";
import { FRAMEWORK_IDS, type FrameworkId } from "../shared/frameworks";
import { importLoadersExpression, mdxJsxElement, type HastContent, type HastRoot } from "../shared/hast";

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

function importSpecifier(mdxFile: string, demo: Demo, variant: DemoVariant): string {
  const entry = variant.files[0].name;
  const dir = relative(dirname(mdxFile), demo.dir).split("\\").join("/");
  return `./${dir}/${entry}`;
}

export type RehypeDemoOptions = {
  cwd?: string;
};

export type DemoVFile = { path?: string; history?: string[]; value?: string };

type DemoTransformer = (tree: HastRoot, file: DemoVFile) => Promise<undefined>;

type UnifiedPlugin = () => DemoTransformer;

/**
 * Replaces `<Demo name />` with a demo carrying every framework's port of it: sources for the code
 * view and lazy loaders for the preview. Each framework must provide the demo.
 */
export function rehypeDemo(options: RehypeDemoOptions = {}): UnifiedPlugin {
  const transform: DemoTransformer = async (tree, file) => {
    const mdxFile = file.path ?? file.history?.[0];
    if (mdxFile === undefined) return;
    const where = relative(options.cwd ?? process.cwd(), mdxFile);

    tree.children = await Promise.all(
      tree.children.map(async (node) => {
        if (!isDemo(node)) return node;

        const name = demoName(node);
        if (name === undefined) throw new Error(`<Demo /> in ${where} is missing a demo name.`);

        const variants = {} as Record<FrameworkId, DemoVariant[]>;
        const loaders = {} as Record<FrameworkId, string[]>;
        for (const framework of FRAMEWORK_IDS) {
          const demo = await collectDemo(mdxFile, name, framework);
          if (demo === undefined || demo.variants.length === 0) {
            throw new Error(
              `<Demo ${name} /> in ${where} has no ${framework} source in ${relative(dirname(mdxFile), demosDir(mdxFile, framework))}/${name}.`,
            );
          }
          variants[framework] = demo.variants.map((variant) => ({ id: variant.id, title: variant.title, files: variant.files }));
          loaders[framework] = demo.variants.map((variant) => importSpecifier(mdxFile, demo, variant));
        }

        const element = mdxJsxElement("Demo", { name, variants }) as unknown as JsxNode;
        element.attributes.push({ type: "mdxJsxAttribute", name: "loaders", value: importLoadersExpression(loaders) });
        return element as unknown as HastContent;
      }),
    );
  };

  return () => transform;
}
