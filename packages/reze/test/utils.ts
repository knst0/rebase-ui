import { tick } from "@rezejs/testing-library";

/**
 * Whether the test runs in JSDOM environment
 */
export const isJSDOM = window.navigator.userAgent.includes("jsdom");

export const nextFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tick();
        resolve();
      });
    });
  });

/**
 * Runs `fn` with real animations enabled, restoring the previous value of
 * `globalThis.REBASE_UI_ANIMATIONS_DISABLED` afterwards.
 */
export async function withRealAnimations<T>(fn: () => T | Promise<T>): Promise<T> {
  const previous = globalThis.REBASE_UI_ANIMATIONS_DISABLED;
  globalThis.REBASE_UI_ANIMATIONS_DISABLED = false;
  try {
    return await fn();
  } finally {
    globalThis.REBASE_UI_ANIMATIONS_DISABLED = previous;
  }
}
