import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as {
  exports: Record<string, { reze: string; types: string; default: string }>;
  publishConfig: {
    exports: Record<string, { reze: string; types: string; default: string }>;
  };
};

describe("package export map", () => {
  it("resolves every export target to an existing source file", () => {
    const missing = Object.entries(manifest.exports)
      .flatMap(([subpath, conditions]) =>
        Object.entries(conditions)
          .filter(([, target]) => !existsSync(join(packageDir, target)))
          .map(([condition]) => `${subpath} [${condition}]`),
      );

    expect(missing).toEqual([]);
  });

  it("keeps the publish mirror in sync with the source export map", () => {
    const published = manifest.publishConfig.exports;

    expect(Object.keys(published).sort()).toEqual(Object.keys(manifest.exports).sort());

    for (const [subpath, target] of Object.entries(manifest.exports)) {
      expect(published[subpath].reze).toBe(target.reze);
      expect(published[subpath].default).toBe(target.default.replace(/^\.\/src\//, "./dist/").replace(/\.ts$/, ".js"));
      expect(published[subpath].types).toBe(target.types.replace(/^\.\/src\//, "./dist/").replace(/\.ts$/, ".d.ts"));
    }
  });

  // NOTE: dist-artifact assertions (mirroring solid's "exposes types for every
  // published subpath" / "ships uncompiled JSX") are intentionally omitted: the
  // reze dist is a release artifact and is not built in this workflow.
});
