import mdx from "@mdx-js/rollup";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { DEFAULT_EXTENSIONS, fileRoutes } from "filesystem-routing/vite";
import rehypeSlug from "rehype-slug";
import { defineConfig } from "vite";
import znaki, { tabler } from "znaki/vite";

import { componentsNav, rehypeCodeValue } from "./plugins/index.ts";

export default defineConfig({
  plugins: [
    {
      ...mdx({
        jsx: true,
        jsxImportSource: "@solidjs/web",
        providerImportSource: "/src/mdx",
        remarkPlugins: [],
        rehypePlugins: [rehypeSlug, rehypeCodeValue],
      }),
      enforce: "pre",
    },
    znaki({
      sources: [tabler()],
    }),
    solid({ start: true, extensions: [".tsx", ".mdx"] }),
    fileRoutes({ types: true, extensions: [...DEFAULT_EXTENSIONS, "mdx"] }),
    componentsNav({ dir: "src/routes/(main)/components", base: "/components" }),
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
