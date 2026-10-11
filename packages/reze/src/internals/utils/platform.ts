/**
 * Static platform detection, evaluated once at module load.
 *
 * Port of upstream `@base-ui/utils/platform` (`os` group only; other groups
 * can be added as ports need them). SSR-safe: every flag is `false` when
 * `navigator` is undefined.
 *
 * ```ts
 * import { platform } from "../platform";
 * if (platform.os.android) { ... }
 * ```
 */

interface NavigatorUAData {
  readonly brands: ReadonlyArray<{ brand: string; version: string }>;
  readonly mobile: boolean;
  readonly platform: string;
}

interface RawNavigatorData {
  readonly userAgent: string;
  readonly platform: string;
  readonly maxTouchPoints: number;
}

/**
 * Reads `navigator.userAgent` / `navigator.platform` (legacy but universally
 * supported) into a normalized shape. In development, prefers the modern
 * `navigator.userAgentData` API on Chromium to avoid DevTools warnings about
 * the deprecated reads; that branch is dead-code-eliminated in production
 * builds to keep the bundle small.
 *
 * Returns empty/zero values when `navigator` is undefined (SSR), so every
 * derived flag safely evaluates to `false`.
 */
function readRawData(): RawNavigatorData {
  if (typeof navigator === "undefined") {
    return { userAgent: "", platform: "", maxTouchPoints: 0 };
  }

  if (process.env.NODE_ENV !== "production") {
    const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData | undefined }).userAgentData;

    if (uaData && Array.isArray(uaData.brands)) {
      return {
        userAgent: uaData.brands.map(({ brand, version }) => `${brand}/${version}`).join(" "),
        platform: uaData.platform ?? navigator.platform ?? "",
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
      };
    }
  }

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform ?? "",
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}

const { userAgent, platform: platformName, maxTouchPoints } = readRawData();
const lowerUserAgent = userAgent.toLowerCase();
const lowerPlatform = platformName.toLowerCase();

// iPadOS 13+ reports `MacIntel` for `navigator.platform`; disambiguated via
// `maxTouchPoints` so iPad is classified as iOS, not macOS.
// https://github.com/mui/base-ui/issues/1309
/** iPhone, iPad (including iPadOS 13+ reporting as macOS), iPod. */
const ios = /^i(os$|p)/.test(lowerPlatform) || (lowerPlatform === "macintel" && maxTouchPoints > 1);

/** Android phones, tablets, and embedded Android browsers. */
const ANDROID_STRING = "android";
const android = lowerPlatform === ANDROID_STRING || lowerUserAgent.includes(ANDROID_STRING);

/** macOS desktop. Excludes iPadOS, which reports as `MacIntel`. */
const mac = !ios && lowerPlatform.startsWith("mac");

/** Windows desktop. */
const windows = lowerPlatform.startsWith("win");

/** Linux desktop (including Chrome OS). */
const linux = !android && /^(linux|chrome os)/.test(lowerPlatform);

/** Any Apple OS (`mac || ios`). */
const apple = mac || ios;

// WebKit (Safari, all iOS browsers, GNOME Web). Distinguished from Blink by
// the legacy `-webkit-backdrop-filter` name — Blink forked from WebKit in 2013
// and only ships the unprefixed `backdrop-filter`.
/** WebKit: Safari, all iOS browsers, GNOME Web. Excludes Blink. */
const webkit = typeof CSS !== "undefined" && !!CSS.supports?.("-webkit-backdrop-filter:none");

/** DOM-emulation test environments, where no pointer shape can be a screen reader press. */
const jsdom = /jsdom|happydom/.test(lowerUserAgent);

export const platform = {
  os: {
    ios,
    android,
    mac,
    windows,
    linux,
    apple,
  },
  engine: {
    webkit,
  },
  env: {
    jsdom,
  },
};
