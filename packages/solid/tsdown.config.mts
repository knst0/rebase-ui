import solid from "@solidjs/vite-plugin";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/*/index.ts"],
  platform: "neutral",
  unbundle: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  dts: true,
  plugins: [solid()],
});
