import { mergeConfig, defineProject } from "vite-plus";

import sharedConfig from "../../vitest.shared.mts";

export default mergeConfig(
  sharedConfig,
  defineProject({
    test: {
      include: ["src/**/*.test.{ts,tsx}", "test/perf.test.ts"],
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("test"),
      "process.env.REBASE_UI_BENCH": JSON.stringify(process.env.REBASE_UI_BENCH ?? ""),
    },
  }),
);
