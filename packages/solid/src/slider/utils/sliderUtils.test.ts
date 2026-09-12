import { describe, expect, it } from "vitest";

import { areArraysEqual } from "./areArraysEqual";
import { asc } from "./asc";
import { clamp } from "./clamp";
import { formatNumber } from "./formatNumber";
import { getPushedThumbValues } from "./getPushedThumbValues";
import { getSliderValue } from "./getSliderValue";
import { resolveThumbCollision } from "./resolveThumbCollision";
import { roundValueToStep } from "./roundValueToStep";
import { validateMinimumDistance } from "./validateMinimumDistance";

describe("asc", () => {
  it("sorts numbers in ascending order", () => {
    expect([30, 10, 20].sort(asc)).toEqual([10, 20, 30]);
  });
});

describe("clamp", () => {
  it("clamps a value to the min/max range", () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

describe("areArraysEqual", () => {
  it("compares arrays element-wise with Object.is semantics", () => {
    expect(areArraysEqual([1, 2], [1, 2])).toBe(true);
    expect(areArraysEqual([1, 2], [1, 3])).toBe(false);
    expect(areArraysEqual([1], [1, 2])).toBe(false);
    expect(areArraysEqual([NaN], [NaN])).toBe(true);
  });
});

describe("formatNumber", () => {
  it("formats numbers and returns an empty string for null", () => {
    expect(formatNumber(null)).toBe("");
    expect(formatNumber(25, "en-US")).toBe("25");
  });
});

describe("getSliderValue", () => {
  it("clamps a single value to the min/max range", () => {
    expect(getSliderValue(150, 0, 0, 100, false, [50])).toBe(100);
    expect(getSliderValue(-10, 0, 0, 100, false, [50])).toBe(0);
  });

  describe("range neighbours", () => {
    it("does not let a thumb cross a neighbour whose value is 0", () => {
      expect(getSliderValue(5, 0, -10, 10, true, [-10, 0])).toEqual([0, 0]);
      expect(getSliderValue(-5, 1, -10, 10, true, [0, 10])).toEqual([0, 0]);
    });

    it("bounds a thumb between its real neighbours", () => {
      expect(getSliderValue(50, 1, 0, 100, true, [20, 40, 80])).toEqual([20, 50, 80]);
      expect(getSliderValue(90, 1, 0, 100, true, [20, 40, 80])).toEqual([20, 80, 80]);
      expect(getSliderValue(10, 1, 0, 100, true, [20, 40, 80])).toEqual([20, 20, 80]);
    });

    it("leaves the outer edges unbounded by missing neighbours", () => {
      expect(getSliderValue(-30, 0, -50, 50, true, [-20, 0])).toEqual([-30, 0]);
      expect(getSliderValue(40, 1, -50, 50, true, [-20, 0])).toEqual([-20, 40]);
    });
  });
});

describe("roundValueToStep", () => {
  it("preserves precision from the step origin", () => {
    expect(roundValueToStep(0.35, 0.1, 0.25)).toBe(0.35);
  });

  it("preserves decimal precision for steps greater than one", () => {
    expect(roundValueToStep(13.2, 1.5, 10.2)).toBe(13.2);
  });
});

describe("validateMinimumDistance", () => {
  it("returns true for scalars and sufficiently spaced values", () => {
    expect(validateMinimumDistance(5, 1, 10)).toBe(true);
    expect(validateMinimumDistance([20, 40], 1, 5)).toBe(true);
  });

  it("returns false when thumbs are closer than the minimum distance", () => {
    expect(validateMinimumDistance([20, 22], 1, 5)).toBe(false);
  });
});

describe("getPushedThumbValues", () => {
  it("pushes the next thumb forward when moving past it", () => {
    const result = getPushedThumbValues([20, 40], 0, 70, 0, 100, 1, 0);

    expect(result).toEqual([70, 70]);
  });

  it("ensures minimum distance between thumbs while pushing forward", () => {
    const result = getPushedThumbValues([20, 40], 0, 60, 0, 100, 1, 5);

    expect(result).toEqual([60, 65]);
  });

  it("pushes previous thumbs backward when moving before them", () => {
    const result = getPushedThumbValues([20, 40], 1, -10, 0, 100, 1, 0);

    expect(result).toEqual([0, 0]);
  });

  it("pushes multiple thumbs in sequence", () => {
    const result = getPushedThumbValues([10, 50, 90], 1, 95, 0, 100, 1, 5);

    expect(result).toEqual([10, 95, 100]);
  });

  it("allows fractional minimum distances", () => {
    const result = getPushedThumbValues([0, 1], 0, 1.4, 0, 10, 1, 0.4);

    expect(result[0]).toBe(1.4);
    expect(result[1]).toBe(1.8);
  });

  it("restores pushed thumbs towards their initial value when space allows", () => {
    const initialValues = [30, 50];

    const pushed = getPushedThumbValues(initialValues, 1, 20, 0, 100, 1, 0, initialValues);

    expect(pushed).toEqual([20, 20]);

    const restored = getPushedThumbValues(pushed, 1, 35, 0, 100, 1, 0, initialValues);

    expect(restored).toEqual([30, 35]);
  });
});

describe("resolveThumbCollision", () => {
  it('prevents thumbs from passing each other when behavior is "none"', () => {
    const result = resolveThumbCollision("none", [20, 40], undefined, undefined, 0, 70, 0, 100, 1, 0);

    expect(result.value).toEqual([40, 40]);
    expect(result.thumbIndex).toBe(0);
    expect(result.didSwap).toBe(false);
  });

  it('pushes thumbs forward without cling when behavior is "push"', () => {
    const result = resolveThumbCollision("push", [20, 40], undefined, undefined, 0, 70, 0, 100, 1, 0);

    expect(result.value).toEqual([70, 70]);
    expect(result.thumbIndex).toBe(0);
    expect(result.didSwap).toBe(false);
  });

  it("keeps pushed thumbs in place when moving backward in push mode", () => {
    const startValues = [20, 40];

    const pushed = resolveThumbCollision("push", startValues, startValues, startValues, 0, 70, 0, 100, 1, 0);

    const nextValues = pushed.value as number[];
    expect(nextValues).toEqual([70, 70]);

    const movedBack = resolveThumbCollision("push", nextValues, nextValues, startValues, 0, 30, 0, 100, 1, 0);

    expect(movedBack.value).toEqual([30, 70]);
    expect(movedBack.thumbIndex).toBe(0);
    expect(movedBack.didSwap).toBe(false);
  });

  it('swaps thumbs when behavior is "swap"', () => {
    const result = resolveThumbCollision("swap", [20, 40], undefined, undefined, 0, 65, 0, 100, 1, 0);

    expect(result.value).toEqual([40, 65]);
    expect(result.thumbIndex).toBe(1);
    expect(result.didSwap).toBe(true);
  });

  it("maintains swap continuity with minimum steps when provided current and initial values", () => {
    const startValues = [20, 80];

    const first = resolveThumbCollision("swap", startValues, startValues, startValues, 0, 85, 0, 100, 1, 10);

    const firstValues = first.value as number[];
    expect(firstValues).toEqual([70, 85]);
    expect(first.thumbIndex).toBe(1);
    expect(first.didSwap).toBe(true);

    const continued = resolveThumbCollision("swap", startValues, firstValues, startValues, first.thumbIndex, 95, 0, 100, 1, 10);

    const continuedValues = continued.value as number[];
    expect(continuedValues).toEqual([70, 95]);
    expect(continued.thumbIndex).toBe(1);
    expect(continued.didSwap).toBe(false);
  });

  it("does not swap before reaching neighbour value with minimum steps", () => {
    const result = resolveThumbCollision("swap", [25, 45], [40, 45], [25, 45], 0, 44, 0, 100, 1, 5);

    const resultValues = result.value as number[];
    expect(resultValues).toEqual([40, 45]);
    expect(result.thumbIndex).toBe(0);
    expect(result.didSwap).toBe(false);
  });

  it("swaps once reaching the neighbour value with minimum steps", () => {
    const result = resolveThumbCollision("swap", [25, 45], [40, 45], [25, 45], 0, 45, 0, 100, 1, 5);

    const resultValues = result.value as number[];
    expect(resultValues).toEqual([40, 45]);
    expect(result.thumbIndex).toBe(1);
    expect(result.didSwap).toBe(true);
  });

  it("does not swap backward before reaching neighbour value with minimum steps", () => {
    const result = resolveThumbCollision("swap", [25, 45], [25, 40], [25, 45], 1, 29, 0, 100, 1, 5);

    const resultValues = result.value as number[];
    expect(resultValues).toEqual([25, 30]);
    expect(result.thumbIndex).toBe(1);
    expect(result.didSwap).toBe(false);
  });

  it("swaps backward once reaching the neighbour value with minimum steps", () => {
    const result = resolveThumbCollision("swap", [25, 45], [25, 40], [25, 45], 1, 25, 0, 100, 1, 5);

    const resultValues = result.value as number[];
    expect(resultValues).toEqual([25, 30]);
    expect(result.thumbIndex).toBe(0);
    expect(result.didSwap).toBe(true);
  });

  it("does not move the clamped neighbour when swapping across with minimum steps", () => {
    const startValues = [25, 45];
    const currentValues = [40, 45];

    const result = resolveThumbCollision("swap", currentValues, currentValues, startValues, 0, 46, 0, 100, 1, 5);

    const resultValues = result.value as number[];
    expect(resultValues).toEqual([40, 46]);
    expect(result.thumbIndex).toBe(1);
    expect(result.didSwap).toBe(true);
  });

  it("uses current values when a controlled range grows during a swap interaction", () => {
    const result = resolveThumbCollision("swap", [20, 40], [20, 40, 60], [20, 40], 1, 70, 0, 100, 1, 0);

    expect(result).toEqual({
      value: [20, 60, 70],
      thumbIndex: 2,
      didSwap: true,
    });
  });

  it("returns a scalar when the live values shrink to one item during an interaction", () => {
    const result = resolveThumbCollision("push", [20, 40], [20], [20, 40], 0, 30, 0, 100, 1, 0);

    expect(result).toEqual({
      value: 30,
      thumbIndex: 0,
      didSwap: false,
    });
  });
});
