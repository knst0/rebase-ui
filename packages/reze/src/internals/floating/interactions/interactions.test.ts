import { cleanup, mount, tick } from "@rezejs/testing-library";
import { store } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { createFloating, type UseFloatingReturn } from "../createFloating";
import { createClick } from "./createClick";
import { createDismiss } from "./createDismiss";
import { createFocus } from "./createFocus";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/**
 * Emulates the owning component: mirrors `onOpenChange` back into the `open`
 * state, since the root store syncs `open` from its owner (a direct
 * `rootStore.update({ open })` is overwritten by that sync on flush).
 * The interaction is created inside the mounted test component so its effects
 * have an owner.
 */
function createOwner<T>(create: (context: UseFloatingReturn["context"]) => T) {
  const opened: Array<boolean> = [];
  const ownerState = store({ open: false });
  let captured: UseFloatingReturn | undefined;
  let interaction: T | undefined;
  function Test(): null {
    captured = createFloating({
      open: () => ownerState.open,
      onOpenChange: (nextOpen) => {
        opened.push(nextOpen);
        ownerState.open = nextOpen;
      },
    });
    interaction = create(captured.context);
    return null;
  }
  const { dispose } = mount(Test);
  tick();
  const setOpen = (value: boolean) => {
    ownerState.open = value;
    tick();
  };
  return { context: captured!.context, opened, setOpen, dispose, interaction: interaction! };
}

function dispatchClick(target: Element) {
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
}

function dispatchEscape(target: Element, isComposing: boolean) {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
  // Happy DOM ignores the `isComposing` init flag; force the native state instead.
  Object.defineProperty(event, "isComposing", { value: isComposing });
  target.dispatchEvent(event);
}

describe("floating interactions", () => {
  it("click opens via the reference onClick handler", () => {
    const { context, opened, dispose, interaction: click } = createOwner((ctx) => createClick(ctx));
    try {
      const reference = document.createElement("button");
      context.refs.setReference(reference);
      const props = click.reference();
      reference.addEventListener("click", (event) => props.onClick(event));
      tick();

      dispatchClick(reference);
      tick();

      expect(opened).toEqual([true]);
      expect(context.rootStore.peek("open")).toBe(true);
    } finally {
      dispose();
    }
  });

  it("click toggles closed when already open", () => {
    const { context, opened, dispose, interaction: click } = createOwner((ctx) => createClick(ctx));
    try {
      const reference = document.createElement("button");
      context.refs.setReference(reference);
      const props = click.reference();
      reference.addEventListener("click", (event) => props.onClick(event));
      tick();

      dispatchClick(reference);
      tick();
      dispatchClick(reference);
      tick();

      expect(opened).toEqual([true, false]);
      expect(context.rootStore.peek("open")).toBe(false);
    } finally {
      dispose();
    }
  });

  it("escape dismisses via the floating onKeyDown handler", () => {
    const { context, opened, setOpen, dispose, interaction: dismiss } = createOwner((ctx) => createDismiss(ctx));
    try {
      setOpen(true);

      dismiss.floating().onKeyDown(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      tick();

      expect(opened).toEqual([false]);
      expect(context.rootStore.peek("open")).toBe(false);
    } finally {
      dispose();
    }
  });

  it("document-level escape dismisses once open", () => {
    const { opened, setOpen, dispose } = createOwner((ctx) => createDismiss(ctx));
    try {
      const outside = document.createElement("button");
      document.body.appendChild(outside);

      setOpen(true);

      outside.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      tick();

      expect(opened).toEqual([false]);

      outside.remove();
    } finally {
      dispose();
    }
  });

  it("does not dismiss with escape key while a composition spans a reopen", () => {
    const { context, opened, setOpen, dispose } = createOwner((ctx) => createDismiss(ctx));
    try {
      const outside = document.createElement("button");
      document.body.appendChild(outside);

      setOpen(true);

      outside.dispatchEvent(new Event("compositionstart", { bubbles: true }));
      setOpen(false);
      setOpen(true);

      dispatchEscape(outside, true);
      tick();

      expect(opened).toEqual([]);
      expect(context.rootStore.peek("open")).toBe(true);

      outside.remove();
    } finally {
      dispose();
    }
  });

  it("does not dismiss with the escape key that ends a composition spanning a reopen", () => {
    const { context, opened, setOpen, dispose } = createOwner((ctx) => createDismiss(ctx));
    try {
      const outside = document.createElement("button");
      document.body.appendChild(outside);

      setOpen(true);

      outside.dispatchEvent(new Event("compositionstart", { bubbles: true }));
      setOpen(false);
      setOpen(true);

      // Safari fires `compositionend` before the `keydown` that ends the composition.
      outside.dispatchEvent(new Event("compositionend", { bubbles: true }));
      dispatchEscape(outside, false);
      tick();

      expect(opened).toEqual([]);
      expect(context.rootStore.peek("open")).toBe(true);

      outside.remove();
    } finally {
      dispose();
    }
  });

  it("dismisses with escape key after closing during IME composition", () => {
    const { context, opened, setOpen, dispose } = createOwner((ctx) => createDismiss(ctx));
    try {
      const outside = document.createElement("button");
      document.body.appendChild(outside);

      setOpen(true);

      // The interaction stays mounted while closed, so the composition that
      // ends after closing must not keep blocking Escape once it reopens.
      outside.dispatchEvent(new Event("compositionstart", { bubbles: true }));
      setOpen(false);
      outside.dispatchEvent(new Event("compositionend", { bubbles: true }));

      setOpen(true);

      dispatchEscape(outside, false);
      tick();

      expect(opened).toEqual([false]);
      expect(context.rootStore.peek("open")).toBe(false);

      outside.remove();
    } finally {
      dispose();
    }
  });

  it("intentional mode ignores the trailing click of a press that started before open", () => {
    const { opened, setOpen, dispose } = createOwner((ctx) => createDismiss(ctx, { outsidePressEvent: "intentional" }));
    try {
      const outside = document.createElement("button");
      document.body.appendChild(outside);

      // Press starts while closed: no document listeners, nothing is marked.
      outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));

      setOpen(true);

      // Trailing click of the pre-open press: ignored by the timing guard.
      outside.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, detail: 1 }));
      expect(opened).toEqual([]);

      // A press that starts while open followed by its click dismisses.
      outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
      outside.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, detail: 1 }));
      tick();
      expect(opened).toEqual([false]);

      outside.remove();
    } finally {
      dispose();
    }
  });

  it("focus opens via the reference onFocus handler", () => {
    const { context, opened, dispose, interaction: focus } = createOwner((ctx) => createFocus(ctx));
    try {
      const reference = document.createElement("button");
      document.body.append(reference);
      context.refs.setReference(reference);
      const props = focus.reference();
      reference.addEventListener("focus", (event) => props.onFocus(event));
      tick();

      reference.focus();
      tick();

      expect(opened).toEqual([true]);
      reference.remove();
    } finally {
      dispose();
    }
  });

  it("closed shadow root: keeps open when the listener effect re-runs mid-press", () => {
    const { context, opened, setOpen, dispose } = createOwner((ctx) => createDismiss(ctx));
    try {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: "closed" });
      const floating = document.createElement("div");
      const inner = document.createElement("button");
      floating.appendChild(inner);
      shadowRoot.appendChild(floating);
      context.refs.setFloating(floating);

      const outside = document.createElement("button");
      document.body.appendChild(outside);

      setOpen(true);

      // Full press inside the shadow content: mousedown's marker is consumed by
      // the outside-press check, mouseup's marker persists (mouseup only resets
      // press-start state). In a closed shadow root this marker is the only
      // inside-press signal the document handlers can observe.
      inner.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true, button: 0 }));
      inner.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true, button: 0 }));

      // A dependency change (e.g. a nested popup closing) re-runs the listener
      // effect mid-press; its cleanup must not drop the inside marker.
      const floating2 = document.createElement("div");
      document.body.appendChild(floating2);
      context.refs.setFloating(floating2);
      tick();

      // Trailing press handling reaching the document must still observe the
      // marker and ignore the press instead of dismissing.
      outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
      tick();

      expect(opened).toEqual([]);

      host.remove();
      outside.remove();
      floating2.remove();
    } finally {
      dispose();
    }
  });

  it("registers floating touch listeners as passive", () => {
    const { context, dispose } = createOwner((ctx) => createDismiss(ctx));
    try {
      const floating = document.createElement("div");
      const addEventListener = vi.spyOn(floating, "addEventListener");
      try {
        context.refs.setFloating(floating);
        tick();

        for (const type of ["touchmove", "touchend"]) {
          expect(addEventListener).toHaveBeenCalledWith(type, expect.any(Function), {
            capture: true,
            passive: true,
          });
        }
      } finally {
        addEventListener.mockRestore();
      }
    } finally {
      dispose();
    }
  });
});
