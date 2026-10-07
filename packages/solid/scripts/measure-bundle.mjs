#!/usr/bin/env node
/**
 * Bundle analyzer for @rebase-ui/solid.
 *
 * Walks the built `dist/<entry>/index.js` import graph per component entry and
 * reports raw / minified / gzip / brotli sizes plus a per-file breakdown.
 * Used to quantify the bundle impact of benchmark-driven changes
 * (e.g. collapsible animation variants) before they land.
 *
 * Usage:
 *   node scripts/measure-bundle.mjs [entry...] [--format table|json|md|html] [--out <file>]
 *   node scripts/measure-bundle.mjs --compare [--baseline <file>] [--tolerance <pct>]
 *   node scripts/measure-bundle.mjs --update-baseline [--baseline <file>]
 *
 *   No positional entries = measure every export in package.json.
 *   --compare diffs gzip against the baseline and exits 1 when any entry
 *   grows by more than --tolerance percent (default 5).
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_ROOT = resolve(PACKAGE_ROOT, "dist");
const DEFAULT_BASELINE = resolve(PACKAGE_ROOT, "scripts", "bundle-baseline.json");

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g;

function parseArgs(argv) {
  const args = { entries: [], format: "table", out: null, compare: false, updateBaseline: false, baseline: DEFAULT_BASELINE, tolerance: 5 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--format") args.format = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--compare") args.compare = true;
    else if (arg === "--update-baseline") args.updateBaseline = true;
    else if (arg === "--baseline") args.baseline = resolve(process.cwd(), argv[++i]);
    else if (arg === "--tolerance") args.tolerance = Number(argv[++i]);
    else if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
    else args.entries.push(arg);
  }
  if (!["table", "json", "md", "html"].includes(args.format)) throw new Error(`Unknown format: ${args.format}`);
  if (Number.isNaN(args.tolerance)) throw new Error(`Invalid tolerance: ${argv.join(" ")}`);
  return args;
}

function discoverEntries() {
  const pkg = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, "package.json"), "utf8"));
  return Object.keys(pkg.exports ?? {})
    .filter((key) => key.startsWith("./") && !key.includes("*"))
    .map((key) => key.slice(2));
}

async function resolveSpecifier(specifier, importer) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(importer), specifier);
  const candidates = base.endsWith(".js") ? [base] : [`${base}.js`, resolve(base, "index.js")];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

async function walk(entryFile) {
  const seen = new Set();
  const ordered = [];
  async function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    ordered.push({ file, source: readFileSync(file, "utf8") });
    const { source } = ordered[ordered.length - 1];
    for (const match of source.matchAll(IMPORT_RE)) {
      const resolved = await resolveSpecifier(match[1] ?? match[2], file);
      if (resolved) await visit(resolved);
    }
  }
  await visit(entryFile);
  return ordered;
}

let minifySync = null;
try {
  ({ minifySync } = await import("oxc-minify"));
} catch {
  console.warn("warning: oxc-minify not resolvable, min sizes will equal raw");
}

function measureSources(sources) {
  const combined = sources.join("\n");
  const raw = Buffer.byteLength(combined);
  let min = raw;
  if (minifySync) {
    try {
      min = Buffer.byteLength(minifySync("bundle.js", combined, { compress: true, mangle: true }).code);
    } catch {
      console.warn("warning: minification failed, min sizes will equal raw");
    }
  }
  const minifiedForCompression = min !== raw ? null : combined;
  void minifiedForCompression;
  return {
    raw,
    min,
    gzip: gzipSync(combined, { level: 9 }).byteLength,
    brotli: brotliCompressSync(combined, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).byteLength,
  };
}

async function measureEntry(name) {
  const entryFile = resolve(DIST_ROOT, name, "index.js");
  const modules = await walk(entryFile);
  const files = modules
    .map(({ file, source }) => ({ file: relative(PACKAGE_ROOT, file).replaceAll("\\", "/"), bytes: Buffer.byteLength(source) }))
    .sort((a, b) => b.bytes - a.bytes);
  return { entry: name, files, ...measureSources(modules.map((m) => m.source)) };
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function padEnd(s, w) {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

function renderTable(rows) {
  const head = ["entry", "raw", "min", "gzip", "brotli"];
  const body = rows.map((r) => [r.entry, formatBytes(r.raw), formatBytes(r.min), formatBytes(r.gzip), formatBytes(r.brotli)]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const line = (cells) => cells.map((c, i) => padEnd(c, widths[i])).join("  ");
  return [line(head), ...body.map(line)].join("\n");
}

function renderMarkdown(rows, diffs) {
  const withDiff = diffs != null;
  const head = withDiff ? "| entry | gzip | baseline | Δ | status |" : "| entry | raw | min | gzip | brotli |";
  const sep = withDiff ? "| --- | ---: | ---: | ---: | --- |" : "| --- | ---: | ---: | ---: | ---: |";
  const lines = rows.map((r) => {
    if (!withDiff)
      return `| ${r.entry} | ${formatBytes(r.raw)} | ${formatBytes(r.min)} | ${formatBytes(r.gzip)} | ${formatBytes(r.brotli)} |`;
    const d = diffs.get(r.entry);
    const delta = d == null ? "n/a" : `${d.delta >= 0 ? "+" : ""}${d.delta} B (${d.pct >= 0 ? "+" : ""}${d.pct.toFixed(1)}%)`;
    const status = d == null ? "⚪ new" : d.fail ? "🔴 over budget" : "🟢 ok";
    const base = d == null ? "n/a" : formatBytes(d.baseline);
    return `| ${r.entry} | ${formatBytes(r.gzip)} | ${base} | ${delta} | ${status} |`;
  });
  return [head, sep, ...lines].join("\n");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderHtml(rows, meta) {
  const max = Math.max(...rows.map((r) => r.gzip));
  const sections = rows
    .map((r) => {
      const pct = ((r.gzip / max) * 100).toFixed(1);
      const fileRows = r.files.map((f) => `<tr><td>${escapeHtml(f.file)}</td><td class="num">${formatBytes(f.bytes)}</td></tr>`).join("");
      return `<section><h2>${escapeHtml(r.entry)} <span class="sizes">${formatBytes(r.gzip)} gzip · ${formatBytes(r.brotli)} brotli · ${formatBytes(r.min)} min · ${formatBytes(r.raw)} raw</span></h2>
<div class="bar"><div style="width:${pct}%"></div></div>
<details><summary>${r.files.length} modules</summary><table><thead><tr><th>module</th><th class="num">raw</th></tr></thead><tbody>${fileRows}</tbody></table></details></section>`;
    })
    .join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bundle report — @rebase-ui/solid</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#111}h2{font-size:1rem}.sizes{font-weight:400;color:#555;font-size:.8rem}.bar{background:#eee;border-radius:4px;height:10px;margin:.4rem 0 1rem}.bar>div{background:#2563eb;height:100%;border-radius:4px}table{border-collapse:collapse;width:100%;font-size:.8rem}th,td{text-align:left;padding:.25rem .5rem;border-bottom:1px solid #eee}td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}details{margin-bottom:1.5rem}.meta{color:#555;font-size:.8rem}</style>
</head><body><h1>Bundle report</h1><p class="meta">${escapeHtml(meta)}</p>${sections}</body></html>`;
}

function gitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: PACKAGE_ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function loadBaseline(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const all = discoverEntries();
  const wanted = args.entries.length > 0 ? all.filter((e) => args.entries.some((f) => e === f || e.includes(f))) : all;
  if (wanted.length === 0) throw new Error(`No entries match: ${args.entries.join(", ")}`);

  const rows = [];
  for (const name of wanted) {
    try {
      rows.push(await measureEntry(name));
    } catch (error) {
      console.warn(`warning: skipping ${name}: ${error.message}`);
    }
  }
  rows.sort((a, b) => b.gzip - a.gzip);

  if (args.updateBaseline) {
    const baseline = {
      generatedAt: new Date().toISOString(),
      gitSha: gitSha(),
      entries: Object.fromEntries(rows.map((r) => [r.entry, { raw: r.raw, min: r.min, gzip: r.gzip, brotli: r.brotli }])),
    };
    mkdirSync(dirname(args.baseline), { recursive: true });
    writeFileSync(args.baseline, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`Baseline written: ${relative(process.cwd(), args.baseline)} (${rows.length} entries)`);
    return;
  }

  let diffs = null;
  let failed = false;
  if (args.compare) {
    const baseline = loadBaseline(args.baseline);
    if (!baseline) throw new Error(`No baseline at ${args.baseline}. Run with --update-baseline first.`);
    diffs = new Map();
    for (const row of rows) {
      const base = baseline.entries?.[row.entry];
      if (!base) continue;
      const delta = row.gzip - base.gzip;
      const pct = base.gzip === 0 ? 0 : (delta / base.gzip) * 100;
      const fail = pct > args.tolerance;
      if (fail) failed = true;
      diffs.set(row.entry, { baseline: base.gzip, delta, pct, fail });
    }
  }

  let output;
  if (args.format === "json") output = JSON.stringify({ generatedAt: new Date().toISOString(), gitSha: gitSha(), entries: rows }, null, 2);
  else if (args.format === "md") output = renderMarkdown(rows, diffs);
  else if (args.format === "html")
    output = renderHtml(
      rows,
      `Generated ${new Date().toISOString()}${gitSha() ? ` at ${gitSha()}` : ""} · ${rows.length} entries · sizes over the treeshaken dist graph, minified with oxc-minify`,
    );
  else if (diffs) {
    output = `${renderTable(rows)}\n\nbaseline: ${relative(process.cwd(), args.baseline)} · tolerance: +${args.tolerance}%\n`;
    for (const row of rows) {
      const d = diffs.get(row.entry);
      if (!d) output += `○ ${row.entry}: no baseline\n`;
      else
        output += `${d.fail ? "✗" : "✓"} ${row.entry}: ${formatBytes(d.baseline)} → ${formatBytes(row.gzip)} (${d.delta >= 0 ? "+" : ""}${d.delta} B, ${d.pct >= 0 ? "+" : ""}${d.pct.toFixed(1)}%)\n`;
    }
  } else output = renderTable(rows);

  if (args.out) {
    mkdirSync(dirname(resolve(process.cwd(), args.out)), { recursive: true });
    writeFileSync(args.out, output.endsWith("\n") ? output : `${output}\n`);
    console.log(`Report written: ${args.out}`);
  } else {
    console.log(output);
  }
  if (failed) {
    console.error(`\nBundle budget exceeded: gzip growth over +${args.tolerance}% in at least one entry.`);
    process.exitCode = 1;
  }
}

await main();
