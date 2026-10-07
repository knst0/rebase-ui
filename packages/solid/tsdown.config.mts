import solid from "@solidjs/vite-plugin";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/*/index.ts",
    "src/slider/thumb/prehydrationScript.min.ts",
    "src/tabs/indicator/prehydrationScript.min.ts",
    "src/internals/prehydration-script/prehydrationScript.stub.ts",
  ],
  platform: "neutral",
  unbundle: true,
  // Keep the browser/default split alive in dist: consumers resolve
  // `#prehydration/*` to the stub (client) or the real script (SSR).
  external: [/^#prehydration\//],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  dts: true,
  plugins: [solid()],
});
