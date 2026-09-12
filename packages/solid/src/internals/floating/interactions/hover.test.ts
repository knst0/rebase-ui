import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { createFloating } from "../createFloating";
import { createHover } from "./createHover";

/**
 * Emulates the owning component: mirrors `onOpenChange` back into the `open`
 * signal, since the root store syncs `open` from its owner (a bare
 * `rootStore.update({ open })` is overwritten by that sync on flush).
 */
function createOwner() {
  const opened: Array<boolean> = [];
  const [open, setOpen] = createSignal(false, { ownedWrite: true });
  const { context } = createFloating({
    open,
    onOpenChange: (nextOpen) => {
      opened.push(nextOpen);
      setOpen(nextOpen);
    },
  });
  return { context, opened, setOpen };
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
  it("opens promptly with delay: 0", () =>
    createRoot((dispose) => {
      const { context, opened } = createOwner();
      createHover(context);

      const reference = document.createElement("button");
      document.body.appendChild(reference);
      context.refs.setReference(reference);
      flush();

      dispatchMouseEnter(reference);
      flush();

      expect(opened).toEqual([true]);
      expect(context.rootStore.select("open")).toBe(true);

      reference.remove();
      dispose();
    }));

  it("opens after the open delay", () =>
    createRoot(async (dispose) => {
      const { context, opened } = createOwner();
      createHover(context, { delay: { open: 20, close: 0 } });

      const reference = document.createElement("button");
      document.body.appendChild(reference);
      context.refs.setReference(reference);
      flush();

      dispatchMouseEnter(reference);
      flush();
      expect(opened).toEqual([]);

      await sleep(40);
      flush();
      expect(opened).toEqual([true]);
      expect(context.rootStore.select("open")).toBe(true);

      reference.remove();
      dispose();
    }));

  it("mouseleave closes the floating element", () =>
    createRoot((dispose) => {
      const { context, opened } = createOwner();
      createHover(context);

      const reference = document.createElement("button");
      document.body.appendChild(reference);
      context.refs.setReference(reference);
      flush();

      dispatchMouseEnter(reference);
      flush();
      expect(opened).toEqual([true]);

      dispatchMouseLeave(reference);
      flush();
      expect(opened).toEqual([true, false]);
      expect(context.rootStore.select("open")).toBe(false);

      reference.remove();
      dispose();
    }));

  it("moving to the floating element keeps it open past the close delay", () =>
    createRoot(async (dispose) => {
      const { context, opened } = createOwner();
      createHover(context, { delay: { open: 0, close: 60 } });

      const reference = document.createElement("button");
      const floating = document.createElement("div");
      document.body.append(reference, floating);
      context.refs.setReference(reference);
      context.refs.setFloating(floating);
      flush();

      dispatchMouseEnter(reference);
      flush();
      expect(opened).toEqual([true]);

      // Leaving the reference starts the delayed close.
      dispatchMouseLeave(reference, floating);
      flush();
      floating.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
      flush();

      await sleep(90);
      flush();
      expect(opened).toEqual([true]);
      expect(context.rootStore.select("open")).toBe(true);

      reference.remove();
      floating.remove();
      dispose();
    }));

  it("restMs gates the open until the cursor rests", () =>
    createRoot(async (dispose) => {
      const { context, opened } = createOwner();
      const hover = createHover(context, { restMs: 30 });

      const reference = document.createElement("button");
      document.body.appendChild(reference);
      context.refs.setReference(reference);
      const props = hover.reference();
      reference.addEventListener("mousemove", (event) => props.onMouseMove(event));
      flush();

      // Entering alone does not open while only a rest delay is configured.
      dispatchMouseEnter(reference);
      flush();
      expect(opened).toEqual([]);

      reference.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      await sleep(50);
      flush();
      expect(opened).toEqual([true]);

      reference.remove();
      dispose();
    }));
});
