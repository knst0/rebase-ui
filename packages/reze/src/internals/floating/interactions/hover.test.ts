import { cleanup, mount, tick } from "@rezejs/testing-library";
import { store } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createFloating, type UseFloatingReturn } from "../createFloating";
import { createHover, type CreateHoverProps } from "./createHover";

afterEach(cleanup);

/**
 * Emulates the owning component: mirrors `onOpenChange` back into the `open`
 * state, since the root store syncs `open` from its owner (a direct
 * `rootStore.update({ open })` is overwritten by that sync on flush).
 */
function createOwner(hoverProps: CreateHoverProps = {}) {
  const opened: Array<boolean> = [];
  const ownerState = store({ open: false });
  let captured: UseFloatingReturn | undefined;
  function Test(): null {
    captured = createFloating({
      open: () => ownerState.open,
      onOpenChange: (nextOpen) => {
        opened.push(nextOpen);
        ownerState.open = nextOpen;
      },
    });
    createHover(captured.context, hoverProps);
    return null;
  }
  const { dispose } = mount(Test);
  tick();
  const setOpen = (value: boolean) => {
    ownerState.open = value;
    tick();
  };
  return { context: captured!.context, opened, setOpen, dispose };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function dispatchMouseEnter(target: Element) {
  target.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: true }));
}

function dispatchMouseLeave(target: Element, relatedTarget: Element | null = document.body) {
  target.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false, cancelable: true, relatedTarget }));
}

describe("createHover", () => {
  it("opens promptly with delay: 0", () => {
    const { context, opened, dispose } = createOwner();
    try {
      const reference = document.createElement("button");
      document.body.appendChild(reference);
      context.refs.setReference(reference);
      tick();

      dispatchMouseEnter(reference);
      tick();

      expect(opened).toEqual([true]);
      expect(context.rootStore.peek("open")).toBe(true);

      reference.remove();
    } finally {
      dispose();
    }
  });

  it("opens after the open delay", async () => {
    const { context, opened, dispose } = createOwner({ delay: { open: 20, close: 0 } });
    try {
      const reference = document.createElement("button");
      document.body.appendChild(reference);
      context.refs.setReference(reference);
      tick();

      dispatchMouseEnter(reference);
      tick();
      expect(opened).toEqual([]);

      await sleep(40);
      tick();
      expect(opened).toEqual([true]);
      expect(context.rootStore.peek("open")).toBe(true);

      reference.remove();
    } finally {
      dispose();
    }
  });

  it("mouseleave closes the floating element", () => {
    const { context, opened, dispose } = createOwner();
    try {
      const reference = document.createElement("button");
      document.body.appendChild(reference);
      context.refs.setReference(reference);
      tick();

      dispatchMouseEnter(reference);
      tick();
      expect(opened).toEqual([true]);

      dispatchMouseLeave(reference);
      tick();
      expect(opened).toEqual([true, false]);
      expect(context.rootStore.peek("open")).toBe(false);

      reference.remove();
    } finally {
      dispose();
    }
  });

  it("moving to the floating element keeps it open past the close delay", async () => {
    const { context, opened, dispose } = createOwner({ delay: { open: 0, close: 60 } });
    try {
      const reference = document.createElement("button");
      const floating = document.createElement("div");
      document.body.append(reference, floating);
      context.refs.setReference(reference);
      context.refs.setFloating(floating);
      tick();

      dispatchMouseEnter(reference);
      tick();
      expect(opened).toEqual([true]);

      // Leaving the reference starts the delayed close.
      dispatchMouseLeave(reference, floating);
      tick();
      floating.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
      tick();

      await sleep(90);
      tick();
      expect(opened).toEqual([true]);
      expect(context.rootStore.peek("open")).toBe(true);

      reference.remove();
      floating.remove();
    } finally {
      dispose();
    }
  });

  it("restMs gates the open until the cursor rests", async () => {
    const opened: Array<boolean> = [];
    const ownerState = store({ open: false });
    let captured: UseFloatingReturn | undefined;
    let mouseMove!: (event: MouseEvent) => void;
    function Test(): null {
      captured = createFloating({
        open: () => ownerState.open,
        onOpenChange: (nextOpen) => {
          opened.push(nextOpen);
          ownerState.open = nextOpen;
        },
      });
      const hover = createHover(captured.context, { restMs: 30 });
      mouseMove = hover.reference().onMouseMove;
      return null;
    }
    const { dispose } = mount(Test);
    tick();
    try {
      const reference = document.createElement("button");
      document.body.appendChild(reference);
      captured!.refs.setReference(reference);
      reference.addEventListener("mousemove", (event) => mouseMove(event));
      tick();

      // Entering alone does not open while only a rest delay is configured.
      dispatchMouseEnter(reference);
      tick();
      expect(opened).toEqual([]);

      reference.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      await sleep(50);
      tick();
      expect(opened).toEqual([true]);

      reference.remove();
    } finally {
      dispose();
    }
  });
});
