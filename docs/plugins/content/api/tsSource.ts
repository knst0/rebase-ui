import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { ApiProp } from "./types";

export type Doc = { text: string; tags: Record<string, string> };

export const EMPTY_DOC: Doc = { text: "", tags: {} };

export type Block = { name: string; body: string; extends: string[]; doc: Doc; start: number };

export function splitTags(body: string): Doc {
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

export function matchBrace(text: string, from: number): number {
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

export function docBefore(text: string, start: number): Doc {
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

export function interfaces(text: string): Map<string, Block> {
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

export function aliases(text: string): Map<string, string> {
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

export function parseMembers(body: string): ApiProp[] {
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

export function normalizeType(type: string): string {
  return type
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*undefined\b/g, "")
    .replace(/\bundefined\s*\|\s*/g, "")
    .trim();
}

export const BUILTIN_TYPES = new Set([
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

export function collectSources(text: string, into: Map<string, string>) {
  for (const [name, source] of aliases(text)) {
    if (!into.has(name)) into.set(name, source);
  }

  for (const [name, block] of interfaces(text)) {
    if (into.has(name)) continue;
    const open = text.indexOf("{", block.start);
    into.set(name, text.slice(block.start, matchBrace(text, open) + 1).trim());
  }
}

export function referencedTypes(type: string): string[] {
  const found = type.match(/\b[A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)?\b/g);
  if (found === null) return [];
  return [...new Set(found)].filter((name) => !BUILTIN_TYPES.has(name));
}

export async function listFilesRecursive(dir: string): Promise<string[]> {
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
