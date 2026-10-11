import { describe, expect, it } from "vite-plus/test";

import { resolvePopupLabel } from "./resolvePopupLabel";

describe("resolvePopupLabel", () => {
  it("prefers an explicit aria-labelledby", () => {
    const trigger = document.createElement("button");
    trigger.id = "trigger";
    expect(resolvePopupLabel({ "aria-labelledby": "custom" }, trigger, "trigger")).toBe("custom");
  });

  it("returns undefined when aria-label is set (labelledby would conflict)", () => {
    const trigger = document.createElement("button");
    trigger.id = "trigger";
    expect(resolvePopupLabel({ "aria-label": "Menu" }, trigger, "trigger")).toBeUndefined();
  });

  it("falls back to the trigger element's live id", () => {
    const trigger = document.createElement("button");
    trigger.id = "live-id";
    expect(resolvePopupLabel({}, trigger, "registered-id")).toBe("live-id");
  });

  it("falls back to the registered trigger id when the element has none", () => {
    const trigger = document.createElement("button");
    expect(resolvePopupLabel({}, trigger, "registered-id")).toBe("registered-id");
    expect(resolvePopupLabel({}, null, "registered-id")).toBe("registered-id");
  });

  it("returns undefined when nothing identifies the trigger", () => {
    expect(resolvePopupLabel({}, null, null)).toBeUndefined();
  });
});
