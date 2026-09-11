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
  rehypeBaseLinks,
  rehypeCodeValue,
  rehypeDemo,
  rehypeReference,
  rehypeSections,
} from "./plugins/index.ts";

const API_REFERENCE = {
  dir: "../packages/solid/src",
  shared: ["../packages/solid/src/internals/types.ts", "../packages/solid/src/types/index.ts"],
};

function resolveBase(): string {
  const raw = (process.env.DOCS_BASE ?? "/").replace(/\\/g, "/");
  const segments = raw.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  if (last === "") return "/";
  if (/^[A-Za-z]:$/.test(last)) return "/";
  return `/${last}/`;
}

const base = resolveBase();
const basePath = base === "/" ? "" : base.replace(/\/$/, "");

export default defineConfig({
  base,
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
          rehypeBaseLinks({ basePath }) as never,
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
      base: `${basePath}/components`,
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
