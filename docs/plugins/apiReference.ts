import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import type { Plugin } from "vite";

export type ApiProp = {
  name: string;
  type: string;
  default?: string;
  description?: string;
  required?: boolean;
};

export type ApiAttribute = {
  name: string;
  type?: string;
  description?: string;
};

export type ApiType = {
  name: string;
  source: string;
};

export type ApiPart = {
  name: string;
  description?: string;
  element?: string;
  documentation?: string;
  props: ApiProp[];
  attributes: ApiAttribute[];
  state?: ApiType;
  definitions: Record<string, string>;
};

export type ApiExportGroup = {
  part: string;
  names: string[];
};

export type ApiComponent = {
  name: string;
  slug: string;
  parts: ApiPart[];
  importSpecifier: string;
  exportGroups: ApiExportGroup[];
  canonicalTypes: Record<string, string>;
};

type Doc = { text: string; tags: Record<string, string> };

const EMPTY_DOC: Doc = { text: "", tags: {} };

const RENDERS = /Renders (?:an?|the) `([^`]+)` element\./;
const DOCUMENTATION = /Documentation:\s*\[[^\]]*\]\(([^)]+)\)/;

function splitTags(body: string): Doc {
  const tags: Record<string, string> = {};
  const lines: string[] = [];

  for (const line of body.split("\n")) {
    const match = /^@(\w+)\s*(.*)$/.exec(line.trim());
    if (match) {
      tags[match[1]] = match[2].trim();
      continue;
    }
    lines.push(line);
  }

  return { text: lines.join("\n").trim(), tags };
}

type Block = { name: string; body: string; extends: string[]; doc: Doc; start: number };

function matchBrace(text: string, from: number): number {
  let depth = 0;
  for (let index = from; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return text.length;
}

function docBefore(text: string, start: number): Doc {
  const before = text.slice(0, start);
  const close = before.lastIndexOf("*/");
  if (close === -1) return EMPTY_DOC;
  if (before.slice(close + 2).trim() !== "") return EMPTY_DOC;
  const open = before.lastIndexOf("/**", close);
  if (open === -1) return EMPTY_DOC;

  const body = before
    .slice(open + 3, close)
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trimEnd())
    .join("\n");

  return splitTags(body);
}

function interfaces(text: string): Map<string, Block> {
  const found = new Map<string, Block>();
  const pattern = /export\s+interface\s+([A-Za-z0-9_]+)(?:<[^>]*>)?\s*(?:extends\s+([^{]+))?\{/g;

  for (const match of text.matchAll(pattern)) {
    const open = match.index + match[0].length - 1;
    const close = matchBrace(text, open);
    found.set(match[1], {
      name: match[1],
      body: text.slice(open + 1, close),
      extends: (match[2] ?? "")
        .split(",")
        .map((part) => part.trim().replace(/<.*$/, ""))
        .filter(Boolean),
      doc: docBefore(text, match.index),
      start: match.index,
    });
  }

  return found;
}

function aliases(text: string): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = /export\s+type\s+([A-Za-z0-9_]+)(?:<[^=]*?>)?\s*=/g;

  for (const match of text.matchAll(pattern)) {
    let index = match.index + match[0].length;
    let depth = 0;

    for (; index < text.length; index += 1) {
      const char = text[index];
      if ("<([{".includes(char)) depth += 1;
      else if (">)]}".includes(char)) depth -= 1;
      else if (char === ";" && depth <= 0) break;
    }

    found.set(match[1], text.slice(match.index, index + 1).trim());
  }

  return found;
}

function members(body: string): ApiProp[] {
  const props: ApiProp[] = [];
  let index = 0;

  while (index < body.length) {
    const rest = body.slice(index);
    const match = /([A-Za-z_$][\w$]*)\s*(\??)\s*:/.exec(rest);
    if (match === null) break;

    const nameAt = index + match.index;
    const valueAt = nameAt + match[0].length;

    let depth = 0;
    let end = valueAt;
    for (; end < body.length; end += 1) {
      const char = body[end];
      if ("<([{".includes(char)) depth += 1;
      else if (">)]}".includes(char)) depth -= 1;
      else if ((char === ";" || char === "\n") && depth <= 0) break;
    }

    const type = body.slice(valueAt, end).trim().replace(/;$/, "");
    if (type !== "") {
      const doc = docBefore(body, nameAt);
      props.push({
        name: match[1],
        type: normalizeType(type),
        default: doc.tags.default,
        description: doc.text === "" ? undefined : doc.text,
        required: match[2] !== "?",
      });
    }

    index = end + 1;
  }

  return props;
}

function normalizeType(type: string): string {
  return type
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*undefined\b/g, "")
    .replace(/\bundefined\s*\|\s*/g, "")
    .trim();
}

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
      // type: doc.tags.type?.replace(/^{|}$/g, ""),
      description: doc.text === "" ? undefined : doc.text,
    });
  }

  return attributes;
}

async function collectAttributeConstants(dir: string): Promise<Map<string, string>> {
  const constants = new Map<string, string>();
  const pattern = /export\s+const\s+([A-Za-z0-9_]+)\s*=\s*"([^"]+)"/g;

  for (const file of await walk(dir)) {
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

  return members(text.slice(open + 1, matchBrace(text, open))).map((prop) => {
    let type = prop.type.replace(/\bState\b/g, stateName);

    if (prop.name === "class" && classValue !== undefined) type = classValue;
    if (prop.name === "as") type = tag === undefined ? "ValidComponent" : `ValidComponent = "${tag}"`;

    return { ...prop, type };
  });
}

const BUILTIN_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "null",
  "undefined",
  "unknown",
  "any",
  "never",
  "void",
  "object",
  "Record",
  "Array",
  "Partial",
  "Omit",
  "Pick",
  "Event",
  "T",
  "State",
]);

function collectSources(text: string, into: Map<string, string>) {
  for (const [name, source] of aliases(text)) {
    if (!into.has(name)) into.set(name, source);
  }

  for (const [name, block] of interfaces(text)) {
    if (into.has(name)) continue;
    const open = text.indexOf("{", block.start);
    into.set(name, text.slice(block.start, matchBrace(text, open) + 1).trim());
  }
}

function referencedTypes(type: string): string[] {
  const found = type.match(/\b[A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)?\b/g);
  if (found === null) return [];
  return [...new Set(found)].filter((name) => !BUILTIN_TYPES.has(name));
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

const COMPONENT_FUNCTION = /export\s+function\s+([A-Za-z0-9_]+)\s*</g;

function partsOf(
  text: string,
  componentName: string,
  shared: Map<string, Block>,
  sharedText: string,
  sources: Map<string, string>,
): ApiPart[] {
  const local = interfaces(text);
  const lookup = new Map([...shared, ...local]);
  const parts: ApiPart[] = [];
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
      if (inherited) props.push(...members(inherited.body));
    }
    if (ownProps) props.push(...members(ownProps.body));
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
    } as ApiPart & { base: string });
  }

  return parts;
}

const NAMESPACE_BARREL = /export\s+\*\s+as\s+([A-Za-z0-9_]+)\s+from\s+"\.\/index\.parts"/;
const PARTS_EXPORT = /export\s*\{\s*([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)\s*\}\s*from\s+"([^"]+)"/g;

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

const VIRTUAL_ID = "virtual:api-reference";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

const PART_ORDER = ["Root", "List", "Tab", "Trigger", "Header", "Item", "Panel", "Indicator", "Content"];

function order(base: string, componentName: string): number {
  if (base === componentName) return -1;
  const index = PART_ORDER.indexOf(base.slice(componentName.length));
  return index === -1 ? PART_ORDER.length : index;
}

async function collectInternalSources(dir: string, sources: Map<string, string>): Promise<void> {
  for (const file of await walk(dir)) {
    if (extname(file) !== ".ts" && extname(file) !== ".tsx") continue;
    if (/\.(test|spec|bench)\.tsx?$/.test(file)) continue;
    collectSources(await readFile(file, "utf8"), sources);
  }
}

async function walk(dir: string): Promise<string[]> {
  const found: string[] = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
        continue;
      }
      found.push(path);
    }
  }

  return found;
}

export type ApiReferenceOptions = {
  dir: string;
  shared?: string[];
};

export async function collectApi(root: string, options: ApiReferenceOptions): Promise<Record<string, ApiComponent>> {
  {
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
      const componentName = slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");

      const files = await walk(join(dir, slug));
      const attributeFiles = new Map<string, string>();
      const parts: (ApiPart & { base: string })[] = [];
      const pending: string[] = [];

      for (const file of files) {
        const name = file.slice(file.lastIndexOf("\\") + 1).replace(/^.*\//, "");
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
        parts.push(...(partsOf(text, componentName, shared, sharedText, sources) as (ApiPart & { base: string })[]));
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
        parts: parts.map(({ base: _base, ...part }) => part),
        importSpecifier: `@rebase-ui/solid/${slug}`,
        exportGroups,
        canonicalTypes: canonicalTypesFor(exportGroups, sources),
      };
    }

    return components;
  }
}

export function apiReference(options: ApiReferenceOptions): Plugin {
  let root = process.cwd();

  return {
    name: "api-reference",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return;
      for (const file of await walk(join(root, options.dir))) this.addWatchFile(file);
      return "export const api = " + JSON.stringify(await collectApi(root, options)) + ";\nexport default api;";
    },
    handleHotUpdate({ file, server }) {
      if (relative(join(root, options.dir), file).startsWith("..")) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: "full-reload" });
    },
  };
}
