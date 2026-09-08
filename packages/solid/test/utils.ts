import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import type { JSX } from "@solidjs/web";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { flush } from "solid-js";

/**
 * Whether the test runs in JSDOM environment
 */
export const isJSDOM = window.navigator.userAgent.includes("jsdom");

// https://stackoverflow.com/questions/53807517/how-to-test-if-two-types-are-exactly-the-same
export type IfEquals<T, U, Y = unknown, N = never> = (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2 ? Y : N;

/**
 * Issues a type error if `Expected` is not identical to `Actual`.
 *
 * `Expected` should be declared when invoking `expectType`.
 * `Actual` should almost always we be a `typeof value` statement.
 *
 * @example `expectType<number | string, typeof value>(value)`
 * TypeScript issues a type error since `value is not assignable to never`.
 * This means `typeof value` is not identical to `number | string`
 * @param _actual
 */
export function expectType<Expected, Actual>(_actual: IfEquals<Actual, Expected, Actual>): void {}

/**
 * Waits for two animation frames and flushes pending reactive work.
 */
export const nextFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flush();
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

export function pressKey(key: string) {
  const element = document.activeElement;
  if (!(element instanceof HTMLElement)) {
    throw new Error("No active HTMLElement to press a key on");
  }

  fireEvent.keyDown(element, { key });
  fireEvent.keyUp(element, { key });
}

export type RenderResult = ReturnType<typeof render> & {
  user: UserEvent;
  remount: (nextUi: () => JSX.Element) => Promise<RenderResult>;
};

export interface Renderer {
  render: (ui: () => JSX.Element) => Promise<RenderResult>;
}

/**
 * Creates a renderer that flushes pending reactive work after mounting and
 * exposes a `userEvent` instance alongside a `remount` helper.
 */
export function createRenderer(): Renderer {
  async function renderUI(ui: () => JSX.Element): Promise<RenderResult> {
    const result = render(ui);
    flush();

    const user = userEvent.setup();

    const remount = async (nextUi: () => JSX.Element) => {
      cleanup();
      return renderUI(nextUi);
    };

    return { ...result, user, remount };
  }

  return { render: renderUI };
}
