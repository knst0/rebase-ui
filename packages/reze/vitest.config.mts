import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import reze from "@rezejs/vite-plugin";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import type { UserWorkspaceConfig } from "vite-plus/test/node";

function rezePackagesDir(): string {
  const entry = realpathSync(fileURLToPath(import.meta.resolve("reze-js")));
  return dirname(dirname(dirname(entry)));
}

const packages = rezePackagesDir();

/** Resolves every Reze package to its sources, so tests never read a stale `dist`. */
const sourceAliases = [
  { find: "reze-js/internal/runtime", replacement: join(packages, "reze-js", "src", "internal", "runtime.ts") },
  { find: "reze-js/internal/async", replacement: join(packages, "reze-js", "src", "internal", "async.ts") },
  { find: "reze-js/internal/reactivity", replacement: join(packages, "reze-js", "src", "internal", "reactivity.ts") },
  { find: "reze-js", replacement: join(packages, "reze-js", "src", "index.ts") },
  { find: "@rezejs/dom/jsx-runtime", replacement: join(packages, "dom", "src", "jsx-runtime.ts") },
  { find: "@rezejs/dom", replacement: join(packages, "dom", "src", "index.ts") },
  { find: "@rezejs/signals/render", replacement: join(packages, "signals", "src", "render.ts") },
  { find: "@rezejs/signals/profile", replacement: join(packages, "signals", "src", "profile.ts") },
  { find: "@rezejs/signals/internal/continuation", replacement: join(packages, "signals", "src", "internal", "continuation.ts") },
  { find: "@rezejs/signals/internal/scope", replacement: join(packages, "signals", "src", "internal", "scope.ts") },
  { find: "@rezejs/signals/internal/resource", replacement: join(packages, "signals", "src", "internal", "resource.ts") },
  { find: "@rezejs/signals", replacement: join(packages, "signals", "src", "index.ts") },
  { find: "@rezejs/testing-library", replacement: join(packages, "testing-library", "src", "index.ts") },
];

// The aliased Reze sources live outside this workspace root; allow serving them.
const rezeCheckout = dirname(packages);

type BrowserModeConfig = (UserWorkspaceConfig["test"] & {})["browser"];

const supportedBrowsers = new Set(["chromium", "webkit", "firefox"] as const);
type SupportedBrowser = typeof supportedBrowsers extends Set<infer U> ? U : never;

function isSupportedBrowser(env: string | undefined): env is SupportedBrowser {
  return !!env && (supportedBrowsers as Set<string>).has(env);
}

function getBrowserConfig(): BrowserModeConfig {
  const environment = process.env.VITEST_ENV;
  if (!environment) {
    return undefined;
  }

  let instances;

  if (environment === "all-browsers") {
    instances = Array.from(supportedBrowsers, (browser) => ({ browser }));
  } else if (isSupportedBrowser(environment)) {
    instances = [{ browser: environment }];
  } else {
    return undefined;
  }

  return {
    enabled: true,
    provider: playwright({
      contextOptions: {
        timezoneId: "UTC",
      },
    }),
    screenshotFailures: false,
    headless: true,
    instances,
  };
}

export default defineConfig({
  plugins: [reze()],
  define: {
    __REZE_HTML__: "false",
    __REZE_HYDRATE__: "false",
    "process.env.REBASE_UI_BENCH": JSON.stringify(process.env.REBASE_UI_BENCH ?? ""),
  },
  server: { fs: { allow: [rezeCheckout] } },
  test: {
    name: "@rebase-ui/reze",
    exclude: ["node_modules", "**/*.spec.*"],
    environment: "happy-dom",
    environmentOptions: { happyDOM: { url: "http://localhost/" } },
    browser: getBrowserConfig(),
    alias: sourceAliases,
    server: { deps: { inline: [/^reze-js$/, /^reze-js\//, /^@rezejs\//] } },
  },
});
