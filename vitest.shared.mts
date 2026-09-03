import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import viteConfig from "@rebase-ui/monorepo-tests/vite.shared.config.ts";
import { playwright } from "@vitest/browser-playwright";
import type { UserWorkspaceConfig } from "vitest/node";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(CURRENT_DIR, "./");
const environment = process.env.VITEST_ENV;

type BrowserModeConfig = (UserWorkspaceConfig["test"] & {})["browser"];

const supportedBrowsers = new Set(["chromium", "webkit", "firefox"] as const);
type SupportedBrowser = typeof supportedBrowsers extends Set<infer U> ? U : never;

function isSupportedBrowser(env: string | undefined): env is SupportedBrowser {
  return !!env && (supportedBrowsers as Set<string>).has(env);
}

function getBrowserConfig(): BrowserModeConfig {
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

const config: UserWorkspaceConfig = {
  ...viteConfig,
  test: {
    exclude: ["node_modules", "**/*.spec.*"],
    globals: true,
    setupFiles: [resolve(WORKSPACE_ROOT, "./test/setupVitest.ts")],
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        pretendToBeVisual: true,
        url: "http://localhost",
      },
    },
    browser: getBrowserConfig(),
    env: {
      VITEST: "true",
    },
    retry: process.env.CI ? 1 : 0,
  },
};

export default config;
