import { defineConfig } from "@knst/clsv";

export const { cva, cx } = defineConfig({
  cache: true,
  cacheSize: 500,
});
