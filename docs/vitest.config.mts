import { defineProject, mergeConfig } from "vitest/config";

import sharedConfig from "../vitest.shared.mts";

export default mergeConfig(
  sharedConfig,
  defineProject({
    test: {
      environment: "node",
      browser: {
        enabled: false,
      },
    },
  }),
);
