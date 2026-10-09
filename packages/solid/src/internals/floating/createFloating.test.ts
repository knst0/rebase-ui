import { createRoot, flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { createFloating } from "./createFloating";

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flush();
}

describe("createFloating", () => {
  it("registers reference and floating elements on the store", () =>
    createRoot((dispose) => {
      const reference = document.createElement("button");
      const floating = document.createElement("div");

      const { refs, context } = createFloating();
      refs.setReference(reference);
      refs.setFloating(floating);
      flush();

      expect(refs.reference.current).toBe(reference);
      expect(refs.floating.current).toBe(floating);
      expect(context.rootStore.select("referenceElement")).toBe(reference);
      expect(context.rootStore.select("floatingElement")).toBe(floating);
      expect(context.elements.domReference).toBe(reference);

      dispose();
    }));

  it("wraps elements passed to setPositionReference into a virtual element", () =>
    createRoot((dispose) => {
      const reference = document.createElement("button");
      document.body.appendChild(reference);

      const { refs } = createFloating();
      refs.setPositionReference(reference);

      const positionReference = refs.reference.current;
      expect(positionReference).not.toBe(reference);
      expect(typeof (positionReference as Element).getBoundingClientRect).toBe("function");

      refs.setPositionReference(null);
      expect(refs.reference.current).toBe(null);

      reference.remove();
      dispose();
    }));

  it("syncs the open option into the store", () =>
    createRoot((dispose) => {
      const { context } = createFloating({ open: () => true });
      flush();

      expect(context.rootStore.select("open")).toBe(true);
      expect(context.open).toBe(true);

      dispose();
    }));

  it("computes a position once both elements are set", async () => {
    await createRoot(async (dispose) => {
      const reference = document.createElement("button");
      const floating = document.createElement("div");
      document.body.appendChild(reference);
      document.body.appendChild(floating);

      const result = createFloating({ placement: "bottom" });
      result.refs.setReference(reference);
      result.refs.setFloating(floating);
      await tick();

      expect(result.isPositioned).toBe(true);
      expect(result.placement).toBe("bottom");
      expect(typeof result.x).toBe("number");
      expect(typeof result.y).toBe("number");
      expect(result.floatingStyles).toEqual({
        position: result.strategy,
        top: result.y,
        left: result.x,
      });

      reference.remove();
      floating.remove();
      dispose();
    });
  });

  it("stays unpositioned while an element is missing", async () => {
    await createRoot(async (dispose) => {
      const reference = document.createElement("button");

      const result = createFloating();
      result.refs.setReference(reference);
      await tick();

      expect(result.isPositioned).toBe(false);

      dispose();
    });
  });
});
