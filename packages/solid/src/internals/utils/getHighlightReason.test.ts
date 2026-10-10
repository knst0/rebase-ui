import { describe, expect, it } from "vite-plus/test";

import { REASONS } from "../event-details/reasons";
import { getHighlightReason } from "./getHighlightReason";

describe("getHighlightReason", () => {
  it("returns none without an event", () => {
    expect(getHighlightReason(undefined)).toBe(REASONS.none);
  });

  it("returns keyboard for keyboard events", () => {
    expect(getHighlightReason(new KeyboardEvent("keydown", { key: "ArrowDown" }))).toBe(REASONS.keyboard);
    expect(getHighlightReason(new KeyboardEvent("keyup", { key: "ArrowDown" }))).toBe(REASONS.keyboard);
  });

  it("returns pointer for mouse and pointer events", () => {
    expect(getHighlightReason(new MouseEvent("mousemove"))).toBe(REASONS.pointer);
    expect(getHighlightReason(new MouseEvent("mouseenter"))).toBe(REASONS.pointer);
    expect(getHighlightReason(new PointerEvent("pointermove", { pointerType: "mouse" }))).toBe(REASONS.pointer);
    expect(getHighlightReason(new PointerEvent("pointerout", { pointerType: "mouse" }))).toBe(REASONS.pointer);
  });

  it("returns none for other event types", () => {
    expect(getHighlightReason(new MouseEvent("click"))).toBe(REASONS.none);
    expect(getHighlightReason(new FocusEvent("focus"))).toBe(REASONS.none);
    expect(getHighlightReason(new Event("rebase-ui"))).toBe(REASONS.none);
  });
});
