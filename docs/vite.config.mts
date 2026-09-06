import mdx from "@mdx-js/rollup";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { routePathFromFile } from "filesystem-routing";
import { DEFAULT_EXTENSIONS, fileRoutes } from "filesystem-routing/vite";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";
import znaki, { tabler } from "znaki/vite";

import {
  apiReference,
  componentsNav,
  DEMOS_DIR,
  llms,
  rehypeCodeValue,
  rehypeDemo,
  rehypeReference,
  rehypeSections,
} from "./plugins/index.ts";

const API_REFERENCE = {
  dir: "../packages/solid/src",
  shared: ["../packages/solid/src/internals/types.ts", "../packages/solid/src/types/index.ts"],
};

export default defineConfig({
  plugins: [
    {
      ...mdx({
        jsx: true,
        jsxImportSource: "@solidjs/web",
        providerImportSource: "/src/mdx",
        remarkPlugins: [remarkFrontmatter, remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          rehypeDemo({ cwd: import.meta.dirname }) as never,
          rehypeReference,
          rehypeSections({ siteName: "Rebase UI" }) as never,
          rehypeCodeValue,
        ],
      }),
      enforce: "pre",
    },
    znaki({
      sources: [tabler()],
    }),
    solid({ start: true, extensions: [".tsx", ".mdx"] }),
    fileRoutes({
      types: true,
      extensions: [...DEFAULT_EXTENSIONS, "mdx"],
      toPath: (src) => (src.split(/[\\/]/).includes(DEMOS_DIR) ? undefined : routePathFromFile(src)),
    }),
    componentsNav({
      dir: "src/routes/(main)/components",
      base: "/components",
      api: API_REFERENCE,
    }),
    apiReference(API_REFERENCE),
    {
      ...llms({ componentsDir: "src/routes/(main)/components", api: API_REFERENCE }),
      apply: "build",
      applyToEnvironment: (environment) => environment.name === "client",
    },
    tailwindcss(),
  ],
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
    assetsInlineLimit: 0,
    cssMinify: "lightningcss",
    modulePreload: {
      polyfill: false,
    },
  },
});
