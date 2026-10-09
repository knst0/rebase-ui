import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    projects: ["packages/*/vitest.config.mts", "packages/solid/vitest.package.config.mts", "docs/vitest.config.mts"],
  },
});
