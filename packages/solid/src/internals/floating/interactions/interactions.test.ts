import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { createFloating } from "../createFloating";
import { createClick } from "./createClick";
import { createDismiss } from "./createDismiss";
import { createFocus } from "./createFocus";

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

function dispatchClick(target: Element) {
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
}

describe("floating interactions", () => {
  it("click opens via the reference onClick handler", () =>
    createRoot((dispose) => {
      const { context, opened } = createOwner();
      const click = createClick(context);

      const reference = document.createElement("button");
      context.refs.setReference(reference);
      const props = click.reference();
      reference.addEventListener("click", (event) => props.onClick(event));
      flush();

      dispatchClick(reference);
      flush();

      expect(opened).toEqual([true]);
      expect(context.rootStore.select("open")).toBe(true);

      dispose();
    }));

  it("click toggles closed when already open", () =>
    createRoot((dispose) => {
      const { context, opened } = createOwner();
      const click = createClick(context);

      const reference = document.createElement("button");
      context.refs.setReference(reference);
      const props = click.reference();
      reference.addEventListener("click", (event) => props.onClick(event));
      flush();

      dispatchClick(reference);
      flush();
      dispatchClick(reference);
      flush();

      expect(opened).toEqual([true, false]);
      expect(context.rootStore.select("open")).toBe(false);

      dispose();
    }));

  it("escape dismisses via the floating onKeyDown handler", () =>
    createRoot((dispose) => {
      const { context, opened, setOpen } = createOwner();
      const dismiss = createDismiss(context);

      setOpen(true);
      flush();

      dismiss.floating().onKeyDown(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      flush();

      expect(opened).toEqual([false]);
      expect(context.rootStore.select("open")).toBe(false);

      dispose();
    }));

  it("document-level escape dismisses once open", () =>
    createRoot((dispose) => {
      const { context, opened, setOpen } = createOwner();
      createDismiss(context);

      const outside = document.createElement("button");
      document.body.appendChild(outside);

      setOpen(true);
      flush();

      outside.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      flush();

      expect(opened).toEqual([false]);

      outside.remove();
      dispose();
    }));

  it("intentional mode ignores the trailing click of a press that started before open", () =>
    createRoot((dispose) => {
      const { context, opened, setOpen } = createOwner();
      createDismiss(context, { outsidePressEvent: "intentional" });

      const outside = document.createElement("button");
      document.body.appendChild(outside);

      // Press starts while closed: no document listeners, nothing is marked.
      outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));

      setOpen(true);
      flush();

      // Trailing click of the pre-open press: ignored by the timing guard.
      outside.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, detail: 1 }));
      expect(opened).toEqual([]);

      // A press that starts while open followed by its click dismisses.
      outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
      outside.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, detail: 1 }));
      flush();
      expect(opened).toEqual([false]);

      outside.remove();
      dispose();
    }));

  it("focus opens via the reference onFocus handler", () =>
    createRoot((dispose) => {
      const { context, opened } = createOwner();
      const focus = createFocus(context);

      const reference = document.createElement("button");
      context.refs.setReference(reference);
      const props = focus.reference();
      reference.addEventListener("focus", (event) => props.onFocus(event));
      flush();

      reference.dispatchEvent(new FocusEvent("focus"));
      flush();

      expect(opened).toEqual([true]);

      dispose();
    }));

  it("registers floating touch listeners as passive", () =>
    createRoot((dispose) => {
      const { context } = createOwner();
      createDismiss(context);

      const floating = document.createElement("div");
      const addEventListener = vi.spyOn(floating, "addEventListener");
      try {
        context.refs.setFloating(floating);
        flush();

        for (const type of ["touchmove", "touchend"]) {
          expect(addEventListener).toHaveBeenCalledWith(type, expect.any(Function), {
            capture: true,
            passive: true,
          });
        }
      } finally {
        addEventListener.mockRestore();
      }

      dispose();
    }));
});
