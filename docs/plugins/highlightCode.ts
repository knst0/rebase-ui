import { highlight } from "sugar-high";
import { lang } from "sugar-high/lang";

const MAGIC = /^\s*(?:\/\/|\{?\s*\/\*|#|<!--)\s*@highlight-(text|line|next-line|start|end)\b(.*?)(?:\*\/\s*\}?|-->)?\s*$/;

type Directive = { kind: "text"; needles: string[] } | { kind: "line" } | { kind: "next-line" } | { kind: "start" } | { kind: "end" };

function parseDirective(line: string): Directive | undefined {
  const match = MAGIC.exec(line);
  if (match === null) return undefined;
  const [, name, rest] = match;
  if (name === "text") {
    const quoted = [...rest.matchAll(/"([^"]*)"|'([^']*)'/g)].map((entry) => entry[1] ?? entry[2]);
    return { kind: "text", needles: quoted.length > 0 ? quoted : [rest.trim()] };
  }
  return { kind: name as Exclude<Directive["kind"], "text"> };
}

type Analysis = {
  code: string;
  highlightedLines: Set<number>;
  needles: string[];
};

function analyze(source: string): Analysis {
  const input = source.split("\n");
  const output: string[] = [];
  const highlightedLines = new Set<number>();
  const needles: string[] = [];

  let range = false;
  let markNext = false;

  for (const raw of input) {
    const directive = parseDirective(raw);

    if (directive === undefined) {
      const index = output.length;
      output.push(raw);
      if (range || markNext) highlightedLines.add(index);
      markNext = false;
      continue;
    }

    switch (directive.kind) {
      case "text":
        needles.push(...directive.needles.filter((needle) => needle !== ""));
        break;
      case "line":
        if (output.length > 0) highlightedLines.add(output.length - 1);
        break;
      case "next-line":
        markNext = true;
        break;
      case "start":
        range = true;
        break;
      case "end":
        range = false;
        break;
      default:
        break;
    }
  }

  return { code: output.join("\n"), highlightedLines, needles };
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

type Segment = { tag: boolean; value: string };

function segmentize(html: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  while (cursor < html.length) {
    if (html[cursor] === "<") {
      const close = html.indexOf(">", cursor);
      const end = close === -1 ? html.length : close + 1;
      segments.push({ tag: true, value: html.slice(cursor, end) });
      cursor = end;
      continue;
    }
    const next = html.indexOf("<", cursor);
    const end = next === -1 ? html.length : next;
    segments.push({ tag: false, value: html.slice(cursor, end) });
    cursor = end;
  }
  return segments;
}

function markInLine(lineHtml: string, needles: string[]): string {
  const segments = segmentize(lineHtml);
  const text = segments
    .filter((segment) => !segment.tag)
    .map((segment) => segment.value)
    .join("");

  const marked = new Array<boolean>(text.length).fill(false);
  let any = false;

  for (const needle of needles) {
    const target = escapeHtml(needle);
    if (target === "") continue;
    let from = 0;
    while (true) {
      const at = text.indexOf(target, from);
      if (at === -1) break;
      for (let index = at; index < at + target.length; index += 1) marked[index] = true;
      any = true;
      from = at + target.length;
    }
  }

  if (!any) return lineHtml;

  const OPEN = '<mark class="sh__mark">';
  const CLOSE = "</mark>";

  let result = "";
  let offset = 0;
  let open = false;

  for (const segment of segments) {
    if (segment.tag) {
      if (open) result += CLOSE;
      result += segment.value;
      if (open) result += OPEN;
      continue;
    }

    for (const char of segment.value) {
      if (marked[offset] && !open) {
        result += OPEN;
        open = true;
      } else if (!marked[offset] && open) {
        result += CLOSE;
        open = false;
      }
      result += char;
      offset += 1;
    }
  }

  if (open) result += CLOSE;
  return collapseEmptyMarks(result);
}

function collapseEmptyMarks(html: string): string {
  return html.replace(/<mark class="sh__mark">(\s*)<\/mark>/g, "$1");
}

export type HighlightCodeOptions = {
  language?: string;
};

export function highlightCode(source: string, options: HighlightCodeOptions = {}): string {
  const { code, highlightedLines, needles } = analyze(source);
  const resolved = lang(options.language ?? "") ?? "typescript";

  const html = highlight(code, {
    lang: resolved,
    markLine(line) {
      if (highlightedLines.has(line.index)) line.className += " sh__line--highlighted";
    },
  });

  if (needles.length === 0) return html;

  return html
    .split("\n")
    .map((lineHtml) => markInLine(lineHtml, needles))
    .join("\n");
}
