import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@rebase-ui/solid-package",
    environment: "node",
    include: ["test/package-exports.test.ts"],
    browser: { enabled: false },
  },
});
