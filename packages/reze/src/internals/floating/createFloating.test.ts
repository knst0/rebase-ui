import { cleanup, mount, tick } from "@rezejs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createFloating, type UseFloatingReturn } from "./createFloating";

afterEach(cleanup);

function setup(options: Parameters<typeof createFloating>[0] = {}) {
  let result: UseFloatingReturn | undefined;
  function Test(): null {
    result = createFloating(options);
    return null;
  }
  const { dispose } = mount(Test);
  tick();
  return { result: result!, dispose };
}

async function tickAsync() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  tick();
}

describe("createFloating", () => {
  it("registers reference and floating elements on the store", () => {
    const { result, dispose } = setup();
    try {
      const reference = document.createElement("button");
      const floating = document.createElement("div");

      const { refs, context } = result;
      refs.setReference(reference);
      refs.setFloating(floating);
      tick();

      expect(refs.reference.current).toBe(reference);
      expect(refs.floating.current).toBe(floating);
      expect(context.rootStore.peek("referenceElement")).toBe(reference);
      expect(context.rootStore.peek("floatingElement")).toBe(floating);
      expect(context.elements.domReference).toBe(reference);
    } finally {
      dispose();
    }
  });

  it("wraps elements passed to setPositionReference into a virtual element", () => {
    const { result, dispose } = setup();
    try {
      const reference = document.createElement("button");
      document.body.appendChild(reference);

      const { refs } = result;
      refs.setPositionReference(reference);

      const positionReference = refs.reference.current;
      expect(positionReference).not.toBe(reference);
      expect(typeof (positionReference as Element).getBoundingClientRect).toBe("function");

      refs.setPositionReference(null);
      expect(refs.reference.current).toBe(null);

      reference.remove();
    } finally {
      dispose();
    }
  });

  it("syncs the open option into the store", () => {
    const { result, dispose } = setup({ open: () => true });
    try {
      expect(result.context.rootStore.peek("open")).toBe(true);
      expect(result.context.open).toBe(true);
    } finally {
      dispose();
    }
  });

  it("computes a position once both elements are set", async () => {
    const { result, dispose } = setup({ placement: "bottom" });
    try {
      const reference = document.createElement("button");
      const floating = document.createElement("div");
      document.body.appendChild(reference);
      document.body.appendChild(floating);

      result.refs.setReference(reference);
      result.refs.setFloating(floating);
      await tickAsync();

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
    } finally {
      dispose();
    }
  });

  it("stays unpositioned while an element is missing", async () => {
    const { result, dispose } = setup();
    try {
      const reference = document.createElement("button");

      result.refs.setReference(reference);
      await tickAsync();

      expect(result.isPositioned).toBe(false);
    } finally {
      dispose();
    }
  });
});
