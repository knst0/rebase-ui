import { join, relative } from "node:path";

import type { Plugin } from "vite";

import { collectApi } from "../content/api/collect";
import { listFilesRecursive } from "../content/api/tsSource";
import type { ApiReferenceOptions } from "../content/api/types";
import type { FrameworkId } from "../shared/frameworks";

const VIRTUAL_ID = "virtual:api-reference";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

/** `virtual:api-reference`: `api[framework][slug]` for every framework package. */
export function apiReference(options: Record<FrameworkId, ApiReferenceOptions>): Plugin {
  let root = process.cwd();
  const sources = Object.values(options);

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
      const api: Record<string, unknown> = {};
      for (const [framework, source] of Object.entries(options)) {
        for (const file of await listFilesRecursive(join(root, source.dir))) this.addWatchFile(file);
        api[framework] = await collectApi(root, source);
      }
      return "export const api = " + JSON.stringify(api) + ";\nexport default api;";
    },
    handleHotUpdate({ file, server }) {
      if (sources.every((source) => relative(join(root, source.dir), file).startsWith(".."))) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: "full-reload" });
    },
  };
}
