import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  ignorePatterns: [...core.ignorePatterns as string[], "docs/*.d.ts"],
  overrides: [
    {
      files: ["**/index.ts"],
      rules: {
        "no-barrel-file": "off"
      },
    },
    {
      files: ["**/prehydrationScript.template.js"],
      rules: {
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
