import { afterEach, describe, expect, it } from "vite-plus/test";

import type { ListStepOptions } from "./composite";
import { getMaxListIndex, getMinListIndex, getNextListIndex } from "./composite";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("getNextListIndex", () => {
  function items(count: number) {
    return Array.from({ length: count }, () => document.body.appendChild(document.createElement("div")));
  }

  const step = { loopFocus: true, allowEscape: false };

  function nextIndex(list: HTMLElement[], currentIndex: number, options: Omit<ListStepOptions, "minIndex" | "maxIndex">) {
    const listRef = { current: list };
    return getNextListIndex(list, currentIndex, {
      ...options,
      minIndex: getMinListIndex(listRef, options.disabledIndices),
      maxIndex: getMaxListIndex(listRef, options.disabledIndices),
    });
  }

  it("steps to the adjacent index", () => {
    expect(nextIndex(items(3), 0, { ...step, decrement: false })).toEqual({
      index: 1,
      wrapped: false,
    });
    expect(nextIndex(items(3), 1, { ...step, decrement: true })).toEqual({
      index: 0,
      wrapped: false,
    });
  });

  it("wraps at either end when looping", () => {
    expect(nextIndex(items(3), 2, { ...step, decrement: false })).toEqual({
      index: 0,
      wrapped: true,
    });
    expect(nextIndex(items(3), 0, { ...step, decrement: true })).toEqual({
      index: 2,
      wrapped: true,
    });
  });

  it("stays at either end without looping", () => {
    const options = { loopFocus: false, allowEscape: false };
    expect(nextIndex(items(3), 2, { ...options, decrement: false }).index).toBe(2);
    expect(nextIndex(items(3), 0, { ...options, decrement: true }).index).toBe(0);
  });

  it("leaves the list at either end when escaping is allowed", () => {
    const options = { loopFocus: true, allowEscape: true };
    expect(nextIndex(items(3), 2, { ...options, decrement: false }).index).toBe(-1);
    expect(nextIndex(items(3), 0, { ...options, decrement: true }).index).toBe(-1);
  });

  it("enters the list at the far end from outside it", () => {
    const options = { loopFocus: true, allowEscape: true };
    expect(nextIndex(items(3), -1, { ...options, decrement: false }).index).toBe(0);
    expect(nextIndex(items(3), -1, { ...options, decrement: true }).index).toBe(2);
  });

  it("skips disabled indices", () => {
    expect(nextIndex(items(4), 0, { ...step, decrement: false, disabledIndices: [1, 2] }).index).toBe(3);
  });
});
