import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT, END, HOME } from "../composite";
import { gridNavigation } from "./gridNavigation";
import { getNavigationIntent, resolveNextIndex } from "./navigation";

let container: HTMLElement | null = null;

function createElements(count: number, disabled: number[] = []) {
  container = document.createElement("div");
  document.body.appendChild(container);

  return Array.from({ length: count }, (_, index) => {
    const element = document.createElement("button");
    if (disabled.includes(index)) {
      element.setAttribute("disabled", "");
    }
    container!.appendChild(element);
    return element;
  });
}

function keyEvent(key: string) {
  return new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
}

function navigate(key: string, overrides: Partial<Parameters<typeof resolveNextIndex>[0]> = {}) {
  const elements = overrides.elements ?? createElements(4);

  return resolveNextIndex({
    direction: "ltr",
    disabledIndices: undefined,
    elements,
    enableHomeAndEndKeys: false,
    event: keyEvent(key),
    grid: undefined,
    highlightedIndex: 0,
    loopFocus: true,
    onLoop: (_event, _prev, next) => next,
    orientation: "horizontal",
    ...overrides,
  });
}

afterEach(() => {
  container?.remove();
  container = null;
});

describe("getNavigationIntent", () => {
  it("maps arrow keys to the horizontal axis for a horizontal composite", () => {
    const intent = getNavigationIntent(keyEvent(ARROW_RIGHT), "horizontal", "ltr");

    expect(intent).toMatchObject({ isForwardKey: true, isBackwardKey: false, forwardKey: ARROW_RIGHT, backwardKey: ARROW_LEFT });
  });

  it("swaps the horizontal axis in rtl", () => {
    const intent = getNavigationIntent(keyEvent(ARROW_LEFT), "horizontal", "rtl");

    expect(intent).toMatchObject({ isForwardKey: true, forwardKey: ARROW_LEFT, backwardKey: ARROW_RIGHT });
  });

  it("ignores horizontal keys for a vertical composite", () => {
    const intent = getNavigationIntent(keyEvent(ARROW_RIGHT), "vertical", "ltr");

    expect(intent).toMatchObject({ isForwardKey: false, isBackwardKey: false, forwardKey: ARROW_DOWN });
  });

  it("accepts both axes when the orientation is `both`", () => {
    expect(getNavigationIntent(keyEvent(ARROW_DOWN), "both", "ltr").isForwardKey).toBe(true);
    expect(getNavigationIntent(keyEvent(ARROW_RIGHT), "both", "ltr").isForwardKey).toBe(true);
  });

  it("flags Home and End regardless of orientation", () => {
    expect(getNavigationIntent(keyEvent(HOME), "vertical", "ltr").isHomeOrEndKey).toBe(true);
    expect(getNavigationIntent(keyEvent(END), "horizontal", "ltr").isHomeOrEndKey).toBe(true);
  });
});

describe("resolveNextIndex", () => {
  it("moves forward to the next index", () => {
    expect(navigate(ARROW_RIGHT)).toEqual({ nextIndex: 1, handled: true, shouldPreventDefault: true });
  });

  it("moves backward to the previous index", () => {
    expect(navigate(ARROW_LEFT, { highlightedIndex: 2 })).toMatchObject({ nextIndex: 1, handled: true });
  });

  it("skips disabled items", () => {
    const elements = createElements(4, [1, 2]);

    expect(navigate(ARROW_RIGHT, { elements })).toMatchObject({ nextIndex: 3 });
  });

  it("loops from the last index to the first", () => {
    expect(navigate(ARROW_RIGHT, { highlightedIndex: 3 })).toMatchObject({ nextIndex: 0 });
  });

  it("loops from the first index to the last", () => {
    expect(navigate(ARROW_LEFT, { highlightedIndex: 0 })).toMatchObject({ nextIndex: 3 });
  });

  it("does not loop when `loopFocus` is false", () => {
    expect(navigate(ARROW_RIGHT, { highlightedIndex: 3, loopFocus: false })).toEqual({
      nextIndex: 3,
      handled: false,
      shouldPreventDefault: false,
    });
  });

  it("lets `onLoop` override the wrapped index", () => {
    const onLoop = vi.fn(() => 2);

    expect(navigate(ARROW_RIGHT, { highlightedIndex: 3, onLoop })).toMatchObject({ nextIndex: 2 });
    expect(onLoop).toHaveBeenCalledWith(expect.any(KeyboardEvent), 3, 0);
  });

  it("ignores Home and End unless enabled", () => {
    expect(navigate(HOME, { highlightedIndex: 2 })).toMatchObject({ handled: false });
    expect(navigate(HOME, { highlightedIndex: 2, enableHomeAndEndKeys: true })).toMatchObject({ nextIndex: 0, handled: true });
  });

  it("moves to the last enabled index on End", () => {
    const elements = createElements(4, [3]);

    expect(navigate(END, { elements, enableHomeAndEndKeys: true })).toMatchObject({ nextIndex: 2 });
  });

  it("reports the key as unhandled when the index does not change", () => {
    expect(navigate(ARROW_DOWN, { orientation: "horizontal" })).toEqual({
      nextIndex: 0,
      handled: false,
      shouldPreventDefault: false,
    });
  });

  it("delegates to the grid navigator when one is supplied", () => {
    const elements = createElements(6);

    expect(navigate(ARROW_DOWN, { elements, orientation: "both", grid: gridNavigation({ cols: 3 }) })).toMatchObject({
      nextIndex: 3,
      handled: true,
      shouldPreventDefault: true,
    });
  });

  it("is pure: it does not touch the event", () => {
    const event = keyEvent(ARROW_RIGHT);
    const preventDefault = vi.spyOn(event, "preventDefault");
    const stopPropagation = vi.spyOn(event, "stopPropagation");

    navigate(ARROW_RIGHT, { event });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });
});
