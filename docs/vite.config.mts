import mdx from "@mdx-js/rollup";
import reze from "@rezejs/vite-plugin";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { routePathFromFile } from "filesystem-routing";
import { DEFAULT_EXTENSIONS, fileRoutes } from "filesystem-routing/vite";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import type { Plugin } from "vite-plus";
import { defineConfig, lazyPlugins } from "vite-plus";
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

const COMPONENTS_DIR = "src/routes/[framework]/components";

const API_REFERENCE = {
  solid: {
    dir: "../packages/solid/src",
    packageName: "@rebase-ui/solid",
    shared: ["../packages/solid/src/internals/types.ts", "../packages/solid/src/types/index.ts"],
  },
  reze: {
    dir: "../packages/reze/src",
    packageName: "@rebase-ui/reze",
    shared: ["../packages/reze/src/internals/types.ts", "../packages/reze/src/types/index.ts"],
  },
};

/** Modules written for Reze: the package sources, the Reze demo ports and the mount bridge. Everything else is Solid. */
const REZE_MODULES = /[\\/]packages[\\/]reze[\\/]src[\\/]|[\\/]_demos[\\/]reze[\\/]|[\\/]docs[\\/]src[\\/]reze[\\/]/;

/** The Reze compiler, limited to `REZE_MODULES` so it never touches the Solid sources sharing the extensions. */
function rezeModules(): Plugin {
  const plugin = reze();
  const transform = plugin.transform as Extract<Plugin["transform"], (...args: never[]) => unknown>;
  return {
    ...plugin,
    transform(code, id, options) {
      if (!REZE_MODULES.test(id)) return null;
      return transform.call(this, code, id, options);
    },
  };
}

/**
 * The Reze compiler (0.1.0) lowers `ref={name}` to `typeof name === "function" ? name(el) : name = el` even when
 * `name` is a `const`, and Rolldown rejects the dead reassignment (ILLEGAL_REASSIGNMENT) in production builds.
 * A `const` can never take that branch, so the assignment is replaced by a same-width `void` (columns, and so the
 * source map, stay intact).
 */
function rezeConstRefs(): Plugin {
  const FALLBACK = /(typeof (\w+) === "function" \? [^;:]*? : )(\2 =)/g;
  return {
    name: "reze-const-refs",
    enforce: "pre",
    transform(code, id) {
      if (!REZE_MODULES.test(id) || !code.includes('=== "function" ?')) return null;
      const next = code.replace(FALLBACK, (match, head: string, name: string, assignment: string) =>
        new RegExp(`\\bconst ${name}\\b`).test(code) ? head + "void".padEnd(assignment.length) : match,
      );
      return next === code ? null : { code: next, map: null };
    },
  };
}

function resolveSiteUrl(): string | undefined {
  const raw = process.env.DOCS_URL?.trim();
  return raw === undefined || raw === "" ? undefined : raw.replace(/\/+$/, "");
}

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
const siteUrl = resolveSiteUrl();

export default defineConfig({
  base,
  plugins: lazyPlugins(() => [
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
    rezeModules(),
    rezeConstRefs(),
    solid({ start: true, extensions: [".tsx", ".mdx"], exclude: [REZE_MODULES] }),
    fileRoutes({
      types: true,
      extensions: [...DEFAULT_EXTENSIONS, "mdx"],
      toPath: (src) => (src.split(/[\\/]/).includes(DEMOS_DIR) ? undefined : routePathFromFile(src)),
    }),
    componentsNav({
      dir: COMPONENTS_DIR,
      base: "/components",
      api: API_REFERENCE,
    }),
    apiReference(API_REFERENCE),
    {
      ...llms({ componentsDir: COMPONENTS_DIR, api: API_REFERENCE, basePath, siteUrl }),
      applyToEnvironment: (environment) => environment.name === "client",
    },
    tailwindcss(),
  ]),
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
