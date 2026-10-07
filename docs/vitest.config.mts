import { defineProject, mergeConfig } from "vitest/config";

import sharedConfig from "../vitest.shared.mts";

const config = mergeConfig(
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

// The shared setup file only registers DOM matchers (jest-dom), which the node-only docs
// tests don't use and which isn't resolvable from this project. `mergeConfig` concatenates
// arrays, so it has to be cleared after the merge.
config.test!.setupFiles = [];

export default config;
