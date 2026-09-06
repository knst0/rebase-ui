import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { pascalFromSlug } from "../../shared/text";
import {
  type Block,
  collectSources,
  docBefore,
  EMPTY_DOC,
  interfaces,
  listFilesRecursive,
  matchBrace,
  parseMembers,
  referencedTypes,
} from "./tsSource";
import type { ApiAttribute, ApiComponent, ApiExportGroup, ApiPart, ApiPartDraft, ApiProp, ApiReferenceOptions, ApiType } from "./types";

const RENDERS = /Renders (?:an?|the) `([^`]+)` element\./;
const DOCUMENTATION = /Documentation:\s*\[[^\]]*\]\(([^)]+)\)/;
const COMPONENT_FUNCTION = /export\s+function\s+([A-Za-z0-9_]+)\s*</g;
const NAMESPACE_BARREL = /export\s+\*\s+as\s+([A-Za-z0-9_]+)\s+from\s+"\.\/index\.parts"/;
const PARTS_EXPORT = /export\s*\{\s*([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)\s*\}\s*from\s+"([^"]+)"/g;

const PART_ORDER = ["Root", "List", "Tab", "Trigger", "Header", "Item", "Panel", "Indicator", "Content"];

function stateOf(text: string, name: string): ApiType | undefined {
  const pattern = new RegExp("export\\s+interface\\s+" + name + "State(?:<[^>]*>)?(?:\\s+extends[^{]+)?\\s*\\{");
  const match = pattern.exec(text);
  if (match === null) return undefined;
  const open = match.index + match[0].length - 1;
  const close = matchBrace(text, open);
  return { name: name + "State", source: text.slice(match.index, close + 1).trim() };
}

function parseAttributes(text: string, constants: Map<string, string>): ApiAttribute[] {
  const attributes: ApiAttribute[] = [];
  const pattern = /export\s+const\s+[A-Za-z0-9_]+\s*=\s*(?:"([^"]+)"|([A-Za-z0-9_.]+))\s*;?/g;

  for (const match of text.matchAll(pattern)) {
    const name = match[1] ?? constants.get(match[2] ?? "") ?? constants.get((match[2] ?? "").split(".").pop() ?? "");
    if (name === undefined) continue;

    const doc = docBefore(text, match.index);
    attributes.push({
      name,
      description: doc.text === "" ? undefined : doc.text,
    });
  }

  return attributes;
}

async function collectAttributeConstants(dir: string): Promise<Map<string, string>> {
  const constants = new Map<string, string>();
  const pattern = /export\s+const\s+([A-Za-z0-9_]+)\s*=\s*"([^"]+)"/g;

  for (const file of await listFilesRecursive(dir)) {
    if (!file.endsWith("DataAttributes.ts")) continue;
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(pattern)) {
      constants.set(match[1], match[2]);
    }
  }

  return constants;
}

function expandClassValue(text: string, stateName: string): string | undefined {
  const match = /export type ClassValue<State> =([\s\S]*?);/.exec(text);
  if (match === null) return undefined;

  return match[1]
    .split("\n")
    .map((line) => line.trim().replace(/^\|\s*/, ""))
    .filter((line) => line !== "" && line !== "ClassValue<State>[]" && line !== "undefined")
    .join(" | ")
    .replace(/ClassValue<State>/g, "ClassValue")
    .replace(/\bState\b/g, stateName)
    .replace(/\s+/g, " ")
    .trim();
}

function sharedProps(text: string, stateName: string, element: string | undefined): ApiProp[] {
  const match = /export type RebaseUIComponentProps<[^>]*> = Omit<[\s\S]*?>\s*&\s*\{/.exec(text);
  if (match === null) return [];

  const open = match.index + match[0].length - 1;
  const classValue = expandClassValue(text, stateName);
  const tag = element === undefined ? undefined : element.replace(/^<|>$/g, "");

  return parseMembers(text.slice(open + 1, matchBrace(text, open))).map((prop) => {
    let type = prop.type.replace(/\bState\b/g, stateName);

    if (prop.name === "class" && classValue !== undefined) type = classValue;
    if (prop.name === "as") type = tag === undefined ? "ValidComponent" : `ValidComponent = "${tag}"`;

    return { ...prop, type };
  });
}

function definitionsFor(props: ApiProp[], state: ApiType | undefined, sources: Map<string, string>): Record<string, string> {
  const definitions: Record<string, string> = {};
  const visited = new Set<string>();
  const queue: string[] = [];

  for (const type of [...props.map((prop) => prop.type), state?.source ?? ""]) {
    queue.push(...referencedTypes(type));
  }

  while (queue.length > 0) {
    const name = queue.shift() as string;
    if (visited.has(name)) continue;
    visited.add(name);

    const source = sources.get(name);
    if (source === undefined) continue;

    definitions[name] = source;
    queue.push(...referencedTypes(source));
  }

  if (state !== undefined) definitions[state.name] = state.source;

  return definitions;
}

function defaultTag(text: string, base: string): string | undefined {
  const signature = new RegExp("export\\s+function\\s+" + base + "\\b");
  const at = signature.exec(text);
  if (at === null) return undefined;

  const after = text.slice(at.index);
  const defaults = /const defaultProps = Object\.freeze\(\{([\s\S]*?)\}\s*satisfies/.exec(after);
  if (defaults === null) return undefined;

  return /\bas:\s*"([^"]+)"/.exec(defaults[1])?.[1];
}

function partsOf(
  text: string,
  componentName: string,
  shared: Map<string, Block>,
  sharedText: string,
  sources: Map<string, string>,
): ApiPartDraft[] {
  const local = interfaces(text);
  const lookup = new Map([...shared, ...local]);
  const parts: ApiPartDraft[] = [];
  const bases = new Set([...text.matchAll(COMPONENT_FUNCTION)].map((match) => match[1]));

  for (const base of bases) {
    const ownProps = local.get(base + "OwnProps");

    const signature = new RegExp("export\\s+function\\s+" + base + "\\b");
    const at = signature.exec(text);
    const doc = at ? docBefore(text, at.index) : (ownProps?.doc ?? EMPTY_DOC);
    const element = RENDERS.exec(doc.text)?.[1] ?? defaultTag(text, base);
    const state = stateOf(text, base);

    const props: ApiProp[] = [];
    for (const parent of ownProps?.extends ?? []) {
      const inherited = lookup.get(parent);
      if (inherited) props.push(...parseMembers(inherited.body));
    }
    if (ownProps) props.push(...parseMembers(ownProps.body));
    props.push(...sharedProps(sharedText, base + "State", element));

    parts.push({
      name: base === componentName ? base : base.slice(componentName.length),
      description: doc.text.replace(RENDERS, "").replace(DOCUMENTATION, "").trim() || undefined,
      element: element === undefined ? undefined : element.startsWith("<") ? element : "<" + element + ">",
      documentation: DOCUMENTATION.exec(doc.text)?.[1],
      props,
      attributes: [],
      state,
      definitions: definitionsFor(props, state, sources),
      base,
    });
  }

  return parts;
}

type BarrelInfo = { namespace?: string };

async function barrelInfo(dir: string, slug: string): Promise<BarrelInfo> {
  const indexText = await readFile(join(dir, slug, "index.ts"), "utf8");
  const namespaced = NAMESPACE_BARREL.exec(indexText);
  return { namespace: namespaced?.[1] };
}

async function exportGroupsFor(dir: string, slug: string, namespace: string | undefined): Promise<ApiExportGroup[]> {
  if (namespace === undefined) return [];

  const partsText = await readFile(join(dir, slug, "index.parts.ts"), "utf8");
  const groups: ApiExportGroup[] = [];

  for (const match of partsText.matchAll(PARTS_EXPORT)) {
    const [, base, alias] = match;
    groups.push({ part: `${namespace}.${alias}`, names: [`${base}Props`, `${base}State`] });
  }

  return groups;
}

function suffixOf(name: string): "Props" | "State" | undefined {
  if (name.endsWith("Props")) return "Props";
  if (name.endsWith("State")) return "State";
  return undefined;
}

function canonicalTypesFor(groups: ApiExportGroup[], sources: Map<string, string>): Record<string, string> {
  const canonical: Record<string, string> = {};

  for (const group of groups) {
    for (const name of group.names) {
      const suffix = sources.has(name) ? suffixOf(name) : undefined;
      if (suffix !== undefined) canonical[`${group.part}.${suffix}`] = name;
    }
  }

  return canonical;
}

function order(base: string, componentName: string): number {
  if (base === componentName) return -1;
  const index = PART_ORDER.indexOf(base.slice(componentName.length));
  return index === -1 ? PART_ORDER.length : index;
}

async function collectInternalSources(dir: string, sources: Map<string, string>): Promise<void> {
  for (const file of await listFilesRecursive(dir)) {
    if (extname(file) !== ".ts" && extname(file) !== ".tsx") continue;
    if (/\.(test|spec|bench)\.tsx?$/.test(file)) continue;
    collectSources(await readFile(file, "utf8"), sources);
  }
}

export async function collectApi(root: string, options: ApiReferenceOptions): Promise<Record<string, ApiComponent>> {
  const dir = join(root, options.dir);
  const shared = new Map<string, Block>();
  const sources = new Map<string, string>();
  let sharedText = "";

  for (const file of options.shared ?? []) {
    try {
      const text = await readFile(join(root, file), "utf8");
      sharedText += text + "\n";
      collectSources(text, sources);
      for (const [name, block] of interfaces(text)) {
        shared.set(name, block);
      }
    } catch {}
  }

  await collectInternalSources(dir, sources);
  const attributeConstants = await collectAttributeConstants(dir);

  const components: Record<string, ApiComponent> = {};

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "internals" || entry.name === "types") continue;

    const slug = entry.name;
    const componentName = pascalFromSlug(slug);

    const files = await listFilesRecursive(join(dir, slug));
    const attributeFiles = new Map<string, string>();
    const parts: ApiPartDraft[] = [];
    const pending: string[] = [];

    for (const file of files) {
      const name = basename(file);
      if (name.endsWith("DataAttributes.ts")) {
        attributeFiles.set(name.slice(0, -"DataAttributes.ts".length), await readFile(file, "utf8"));
        continue;
      }
      if (extname(name) !== ".tsx" || /\.(test|spec|bench)\.tsx$/.test(name)) continue;
      const text = await readFile(file, "utf8");
      collectSources(text, sources);
      pending.push(text);
    }

    for (const text of pending) {
      parts.push(...partsOf(text, componentName, shared, sharedText, sources));
    }

    if (parts.length === 0) continue;

    for (const part of parts) {
      const text = attributeFiles.get(part.base);
      if (text !== undefined) part.attributes = parseAttributes(text, attributeConstants);
    }

    parts.sort((a, b) => order(a.base, componentName) - order(b.base, componentName));

    const { namespace } = await barrelInfo(dir, slug);
    const exportGroups = await exportGroupsFor(dir, slug, namespace);

    components[slug] = {
      name: componentName,
      slug,
      parts: parts.map(({ base: _base, ...part }): ApiPart => part),
      importSpecifier: `@rebase-ui/solid/${slug}`,
      exportGroups,
      canonicalTypes: canonicalTypesFor(exportGroups, sources),
    };
  }

  return components;
}
