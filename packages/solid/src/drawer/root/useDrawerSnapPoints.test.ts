import { describe, expect, it } from "vitest";

import { getDisplacement } from "../utils/createSwipeDismiss";
import { closestSnapPointIndex, getSnapPointSwipeMovement } from "./useDrawerSnapPoints";

describe("getSnapPointSwipeMovement", () => {
  it("passes movement through while the offset stays open", () => {
    expect(getSnapPointSwipeMovement(100, -40)).toBe(-40);
    expect(getSnapPointSwipeMovement(100, 20)).toBe(20);
  });

  it("damps movement that overshoots the fully-open edge", () => {
    // nextOffset = 100 - 150 = -50 -> -sqrt(50) - 100
    expect(getSnapPointSwipeMovement(100, -150)).toBeCloseTo(-Math.sqrt(50) - 100);
  });
});

describe("closestSnapPointIndex", () => {
  it("returns -1 for an empty list", () => {
    expect(closestSnapPointIndex([], 10)).toBe(-1);
  });

  it("returns the index of the closest value", () => {
    expect(closestSnapPointIndex([0, 100, 200], 140)).toBe(1);
    expect(closestSnapPointIndex([0, 100, 200], 160)).toBe(2);
  });
});

describe("getDisplacement", () => {
  it("projects deltas onto each swipe direction", () => {
    expect(getDisplacement("down", 3, 7)).toBe(7);
    expect(getDisplacement("up", 3, 7)).toBe(-7);
    expect(getDisplacement("right", 3, 7)).toBe(3);
    expect(getDisplacement("left", 3, 7)).toBe(-3);
  });
});
