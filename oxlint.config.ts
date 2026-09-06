import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: ["docs/*.d.ts"],
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
});
