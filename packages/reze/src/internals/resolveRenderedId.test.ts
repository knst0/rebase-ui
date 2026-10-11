import { describe, expect, it, vi } from "vite-plus/test";

import { createRenderedId, resolveRenderedId } from "./resolveRenderedId";

describe("resolveRenderedId", () => {
  it("prefers the explicit id over the fallback", () => {
    expect(resolveRenderedId({ id: "custom" }, "generated")).toBe("custom");
  });

  it("falls back to the generated id", () => {
    expect(resolveRenderedId({}, "generated")).toBe("generated");
  });

  it("treats an explicitly empty id as no id (no fallback)", () => {
    expect(resolveRenderedId({ id: "" }, "generated")).toBe("");
  });
});

describe("createRenderedId", () => {
  it("publishes only explicit ids and clears on unmount", () => {
    const setId = vi.fn();
    const [id, ref] = createRenderedId({ id: "custom" }, "generated", setId);
    expect(id).toBe("custom");

    const element = document.createElement("div");
    ref(element);
    expect(setId).toHaveBeenLastCalledWith("custom");
    ref(null);
    expect(setId).toHaveBeenLastCalledWith(undefined);
  });

  it("never publishes the generated fallback as an override", () => {
    const setId = vi.fn();
    const [id, ref] = createRenderedId({}, "generated", setId);
    expect(id).toBe("generated");

    ref(document.createElement("div"));
    expect(setId).toHaveBeenLastCalledWith(undefined);
  });
});
