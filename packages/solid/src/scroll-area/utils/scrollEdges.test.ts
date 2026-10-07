import { describe, expect, it } from "vitest";

import { normalizeScrollOffset, SCROLL_EDGE_TOLERANCE_PX } from "./scrollEdges";

describe("normalizeScrollOffset", () => {
  it("returns 0 when there is nothing to scroll", () => {
    expect(normalizeScrollOffset(50, 0)).toBe(0);
    expect(normalizeScrollOffset(-10, 0)).toBe(0);
  });

  it("clamps negative values to the start", () => {
    expect(normalizeScrollOffset(-50, 200)).toBe(0);
  });

  it("clamps values past the end to the max", () => {
    expect(normalizeScrollOffset(250, 200)).toBe(200);
  });

  it("passes through mid-range values untouched", () => {
    expect(normalizeScrollOffset(50, 200)).toBe(50);
  });

  it(`snaps values within ${SCROLL_EDGE_TOLERANCE_PX}px of the start to 0`, () => {
    expect(normalizeScrollOffset(SCROLL_EDGE_TOLERANCE_PX, 200)).toBe(0);
  });

  it(`snaps values within ${SCROLL_EDGE_TOLERANCE_PX}px of the end to the max`, () => {
    expect(normalizeScrollOffset(200 - SCROLL_EDGE_TOLERANCE_PX, 200)).toBe(200);
  });

  it("prefers the nearer edge when within tolerance of both", () => {
    expect(normalizeScrollOffset(0, 1)).toBe(0);
    expect(normalizeScrollOffset(1, 1)).toBe(1);
  });
});
