import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["docs/*.d.ts"],
    sortImports: true,
    sortTailwindcss: {
      functions: ["cx"],
      preserveWhitespace: true,
    },
    sortPackageJson: {
      sortScripts: true,
    },
  },
  lint: {
    ignorePatterns: ["docs/*.d.ts"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["**/index.ts"],
        rules: {
          "no-barrel-file": "off",
        },
      },
      {
        files: ["**/prehydrationScript.template.js"],
        rules: {
          "prefer-const": "off",
          "no-unsafe-assignment": "off",
          "no-unsafe-call": "off",
          "no-unsafe-member-access": "off",
        },
      },
      {
        files: ["**/*.spec.tsx"],
        rules: {
          "no-unused-expressions": "off",
          "no-unused-vars": "off",
        },
      },
    ],
  },
});
