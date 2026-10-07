import { join, relative } from "node:path";

import type { Plugin } from "vite";

import { collectApi } from "../content/api/collect";
import { listFilesRecursive } from "../content/api/tsSource";
import type { ApiReferenceOptions } from "../content/api/types";

const VIRTUAL_ID = "virtual:api-reference";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

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
      for (const file of await listFilesRecursive(join(root, options.dir))) this.addWatchFile(file);
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
