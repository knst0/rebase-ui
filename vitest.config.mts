import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*/vitest.config.mts", "packages/solid/vitest.package.config.mts", "docs/vitest.config.mts"],
  },
});
