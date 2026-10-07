import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: ["docs/*.d.ts"],
  sortImports: true,
  sortTailwindcss: {
    functions: ["cx"],
    preserveWhitespace: true,
  },
  sortPackageJson: {
    sortScripts: true,
  },
});
