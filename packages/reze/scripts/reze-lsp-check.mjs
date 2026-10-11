#!/usr/bin/env node
// Queries reze-lsp for compiler diagnostics (and quickfixes) on the given files.
// Usage: node scripts/reze-lsp-check.mjs [--actions] <file...>  (paths relative to package root)
// Exit 0 when no errors/warnings; exit 1 otherwise. Honors REZE_LSP to override the binary.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = dirname(here);
const LSP = process.env.REZE_LSP ?? resolve(pkgRoot, "../../../../reze-js/target/debug/reze-lsp");

const args = process.argv.slice(2);
const wantActions = args.includes("--actions");
const files = args.filter((a) => a !== "--actions").map((f) => resolve(pkgRoot, f));
if (files.length === 0) {
  console.error("usage: reze-lsp-check.mjs [--actions] <file...>");
  process.exit(2);
}

const SEVERITY = { 1: "error", 2: "warning", 3: "info", 4: "hint" };

function encode(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8"), body]);
}

async function main() {
  const child = spawn(LSP, [], { stdio: ["pipe", "pipe", "inherit"] });
  child.on("error", (error) => {
    console.error(`cannot start reze-lsp at ${LSP}: ${error.message}`);
    process.exit(2);
  });

  let buffer = Buffer.alloc(0);
  const pending = new Map();
  let nextId = 1;
  const diagnosticsByUri = new Map();

  function send(message) {
    child.stdin.write(encode(message));
  }
  function request(method, params) {
    const id = nextId++;
    send({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolveRequest) => pending.set(id, resolveRequest));
  }

  child.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = buffer.subarray(0, headerEnd).toString("utf8");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) throw new Error("missing Content-Length in LSP frame");
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buffer.length < start + length) return;
      const message = JSON.parse(buffer.subarray(start, start + length).toString("utf8"));
      buffer = buffer.subarray(start + length);
      if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
        pending.get(message.id)?.(message);
        pending.delete(message.id);
      } else if (message.method === "textDocument/publishDiagnostics") {
        diagnosticsByUri.set(message.params.uri, message.params.diagnostics ?? []);
      }
    }
  });

  await request("initialize", { processId: process.pid, rootUri: pathToFileURL(pkgRoot).href, capabilities: {} });
  send({ jsonrpc: "2.0", method: "initialized", params: {} });

  let failures = 0;
  for (const file of files) {
    const uri = pathToFileURL(file).href;
    const text = readFileSync(file, "utf8");
    diagnosticsByUri.delete(uri);
    send({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: { textDocument: { uri, languageId: "typescriptreact", version: 1, text } },
    });
    const deadline = Date.now() + 15000;
    while (!diagnosticsByUri.has(uri) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
    }
    const diagnostics = diagnosticsByUri.get(uri);
    const rel = relative(pkgRoot, file);
    if (diagnostics === undefined) {
      console.log(`${rel}: TIMEOUT waiting for diagnostics`);
      failures++;
    } else if (diagnostics.length === 0) {
      console.log(`${rel}: clean`);
    } else {
      for (const d of diagnostics) {
        const { start, end } = d.range;
        console.log(
          `${rel}:${start.line + 1}:${start.character + 1}-${end.line + 1}:${end.character + 1} [${SEVERITY[d.severity] ?? d.severity}] ${d.message}${d.code ? ` (${JSON.stringify(d.code)})` : ""}`,
        );
        if (d.severity === 1 || d.severity === 2) failures++;
      }
      if (wantActions) {
        for (const d of diagnostics) {
          const response = await request("textDocument/codeAction", {
            textDocument: { uri },
            range: d.range,
            context: { diagnostics: [d], only: ["quickfix"] },
          });
          for (const action of response.result ?? []) {
            console.log(`  quickfix: ${action.title}`);
            const edit = action.edit?.changes?.[uri] ?? [];
            for (const e of edit)
              console.log(`    -> ${JSON.stringify(e.newText)} @ ${e.range.start.line + 1}:${e.range.start.character + 1}`);
          }
        }
      }
    }
    send({ jsonrpc: "2.0", method: "textDocument/didClose", params: { textDocument: { uri } } });
  }

  await request("shutdown", null);
  send({ jsonrpc: "2.0", method: "exit", params: null });
  child.stdin.end();
  setTimeout(() => child.kill(), 2000).unref();
  process.exit(failures === 0 ? 0 : 1);
}

main();
