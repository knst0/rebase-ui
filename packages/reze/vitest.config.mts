import reze from "@rezejs/vite-plugin";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import type { UserWorkspaceConfig } from "vite-plus/test/node";

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
  test: {
    name: "@rebase-ui/reze",
    exclude: ["node_modules", "**/*.spec.*"],
    environment: "happy-dom",
    environmentOptions: { happyDOM: { url: "http://localhost/" } },
    browser: getBrowserConfig(),
    server: { deps: { inline: [/^reze-js$/, /^reze-js\//, /^@rezejs\//] } },
  },
});
