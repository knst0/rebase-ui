import { defineProject } from "vite-plus";

export default defineProject({
  test: {
    name: "@rebase-ui/solid-package",
    environment: "node",
    include: ["test/package-exports.test.ts"],
    browser: { enabled: false },
  },
});
