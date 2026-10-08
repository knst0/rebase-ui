import solid from "@solidjs/vite-plugin";
import { defineConfig } from "tsdown";

const define = {
  "process.env.NODE_ENV": JSON.stringify("production"),
};

export default defineConfig([
  {
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
    define,
    dts: true,
    plugins: [solid()],
  },
  {
    // The `solid` export condition: JSX left intact so the consumer's Solid
    // compiler emits the server, hydratable, or DOM output its build needs.
    // Bundled per subpath with shared chunks: Vite never pre-bundles
    // `solid`-condition packages, so an unbundled tree costs a dev request
    // per internal module.
    entry: ["src/*/index.ts"],
    outDir: "dist/solid",
    platform: "neutral",
    unbundle: false,
    external: [/^#prehydration\//],
    define,
    dts: false,
    inputOptions: { transform: { jsx: "preserve" } },
    outExtensions: () => ({ js: ".jsx" }),
  },
]);
