import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as {
  exports: Record<string, string>;
  publishConfig: { exports: Record<string, string> };
};

describe("package export map", () => {
  it("resolves every export target to an existing source file", () => {
    const missing = Object.entries(manifest.exports)
      .filter(([, target]) => !existsSync(join(packageDir, target)))
      .map(([subpath]) => subpath);

    expect(missing).toEqual([]);
  });

  it("keeps the publish mirror in sync with the source export map", () => {
    const published = manifest.publishConfig.exports;

    expect(Object.keys(published).sort()).toEqual(Object.keys(manifest.exports).sort());

    for (const [subpath, target] of Object.entries(manifest.exports)) {
      expect(published[subpath]).toBe(target.replace(/^\.\/src\//, "./dist/").replace(/\.ts$/, ".js"));
    }
  });
});
