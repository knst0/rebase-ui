import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/*.ts", "!src/**/*.test.ts"],
  platform: "neutral",
  unbundle: true,
  dts: true,
});
