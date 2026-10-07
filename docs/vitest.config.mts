import { defineProject } from "vitest/config";

import sharedConfig from "../vitest.shared.mts";

// The docs tests are node-only and import no Solid code, so the shared Solid plugin is
// dropped: in test mode it injects a jest-dom `setupFiles` entry (a DOM-matcher setup that
// isn't resolvable from this project) whenever it manages to find jest-dom, which makes the
// suite fail intermittently. The shared setup file is left out for the same reason.
const { setupFiles: _setupFiles, ...sharedTest } = sharedConfig.test!;

export default defineProject({
  ...sharedConfig,
  plugins: [],
  test: {
    ...sharedTest,
    environment: "node",
    browser: { enabled: false },
  },
});
