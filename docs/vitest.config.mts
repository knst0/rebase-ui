import { defineProject } from "vitest/config";

import sharedConfig from "../vitest.shared.mts";

// The shared setup file only registers DOM matchers (jest-dom), which the node-only docs
// tests don't use and which isn't resolvable from this project, so it is left out.
const { setupFiles: _setupFiles, ...sharedTest } = sharedConfig.test!;

export default defineProject({
  ...sharedConfig,
  test: {
    ...sharedTest,
    environment: "node",
    browser: { enabled: false },
  },
});
