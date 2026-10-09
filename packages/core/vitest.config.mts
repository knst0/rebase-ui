import { defineProject } from "vite-plus";

export default defineProject({
  test: {
    name: "@rebase-ui/core",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
