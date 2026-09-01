import solid from "@solidjs/vite-plugin";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/*/index.ts"],
  platform: "neutral",
  unbundle: true,
  dts: true,
  plugins: [solid()],
});
