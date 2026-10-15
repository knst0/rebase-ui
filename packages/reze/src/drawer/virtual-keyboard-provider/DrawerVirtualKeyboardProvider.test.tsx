import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Drawer from "../index.parts";

afterEach(cleanup);

const isJSDOM = window.navigator.userAgent.includes("jsdom");

interface FakeVisualViewport {
  scale: number;
  height: number;
  offsetTop: number;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

function mockWindowInnerHeight(initialHeight: number) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, "innerHeight");
  let innerHeight = initialHeight;

  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    get: () => innerHeight,
  });

  return {
    resize(nextHeight: number) {
      innerHeight = nextHeight;
      window.dispatchEvent(new Event("resize"));
    },
    restore() {
      if (originalDescriptor) {
        Object.defineProperty(window, "innerHeight", originalDescriptor);
      } else {
        Reflect.deleteProperty(window, "innerHeight");
      }
    },
  };
}

function mockVisualViewport(initialHeight: number) {
  const listeners = new Map<string, Set<EventListener>>();
  const viewport: FakeVisualViewport = {
    scale: 1,
    height: initialHeight,
    offsetTop: 0,
    addEventListener: (type, listener) => {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
  };
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, "visualViewport");
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });

  return {
    resize(nextHeight: number) {
      viewport.height = nextHeight;
      for (const type of ["resize", "scroll"]) {
        listeners.get(type)?.forEach((listener) => listener(new Event(type)));
      }
    },
    restore() {
      if (originalDescriptor) {
        Object.defineProperty(window, "visualViewport", originalDescriptor);
      } else {
        Reflect.deleteProperty(window, "visualViewport");
      }
    },
  };
}

// New Chrome on iOS shrinks `svh` for the keyboard before resizing the layout viewport.
function isSmallViewportProbe(element: HTMLElement) {
  // happy-dom drops the `100svh` unit while parsing inline styles, so the probe is detected
  // by its other inline styles there; jsdom and real browsers keep the height value.
  return element.style.height === "100svh" || (element.style.position === "fixed" && element.style.visibility === "hidden");
}

function mockSmallViewportHeight(initialHeight: number) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  if (!originalDescriptor?.get) {
    throw new Error("offsetHeight is not a configurable getter in this environment");
  }
  let smallViewportHeight = initialHeight;

  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return isSmallViewportProbe(this) ? smallViewportHeight : (originalDescriptor.get?.call(this) ?? 0);
    },
  });

  return {
    set(nextHeight: number) {
      smallViewportHeight = nextHeight;
    },
    restore() {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalDescriptor);
    },
  };
}

function mockScrollGeometry(scroll: HTMLElement, rect: { top: number; bottom: number }) {
  Object.defineProperties(scroll, {
    clientHeight: { configurable: true, value: 420 },
    scrollHeight: { configurable: true, value: 1200 },
  });
  scroll.getBoundingClientRect = () =>
    ({
      top: rect.top,
      bottom: rect.bottom,
      height: rect.bottom - rect.top,
      left: 0,
      right: 320,
      width: 320,
      x: 0,
      y: rect.top,
      toJSON: () => {},
    }) as DOMRect;
  // DOM emulation has no element scrollTo; alignment only needs it not to throw.
  scroll.scrollTo = () => {};
}

function mockElementFromPoint(target: Element | null) {
  const original = document.elementFromPoint?.bind(document);
  document.elementFromPoint = () => target;
  return () => {
    if (original === undefined) {
      Reflect.deleteProperty(document, "elementFromPoint");
    } else {
      document.elementFromPoint = original;
    }
  };
}

function dispatchTouch(
  target: EventTarget,
  type: "touchstart" | "touchmove" | "touchend",
  touches: Array<{ clientX: number; clientY: number }>,
) {
  const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, "touches", { value: touches });
  Object.defineProperty(event, "changedTouches", { value: touches });
  target.dispatchEvent(event);
  return event;
}

describe("<Drawer.VirtualKeyboardProvider />", () => {
  it("reads no reactive values outside a tracking scope when focusing a field", async () => {
    const diagnostics: string[] = [];
    const originalWarn = console.warn;
    const originalError = console.error;
    const recordDiagnostic = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("STRICT_READ_UNTRACKED")) {
        diagnostics.push(args[0]);
      }
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      recordDiagnostic(...args);
      originalWarn(...args);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      recordDiagnostic(...args);
      originalError(...args);
    });

    try {
      mount(() => (
        <Drawer.Root>
          <Drawer.Trigger>Open drawer</Drawer.Trigger>
          <Drawer.VirtualKeyboardProvider>
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup>
                  <Drawer.Title>Drawer title</Drawer.Title>
                  <Drawer.Content>
                    <label>
                      Name
                      <input type="text" placeholder="Ada Lovelace" />
                    </label>
                  </Drawer.Content>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.VirtualKeyboardProvider>
        </Drawer.Root>
      ));

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Open drawer" }));
      tick();
      await nextFrames();

      await user.click(screen.getByPlaceholderText("Ada Lovelace"));
      tick();
      await nextFrames();

      expect(diagnostics).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("compensates for keyboard overlap without adding extra spacing and centers the focused input", async () => {
    const restoreInnerHeight = mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);
    const smallViewport = mockSmallViewportHeight(800);

    try {
      mount(() => (
        <Drawer.Root open modal={false}>
          <Drawer.VirtualKeyboardProvider>
            <Drawer.Portal>
              <Drawer.Viewport data-testid="viewport">
                <Drawer.Popup>
                  <Drawer.Content data-testid="scroll" style={{ height: "420px", "overflow-y": "auto", "padding-bottom": "0px" }}>
                    <div style={{ height: "900px" }} />
                    <input data-testid="input" type="text" />
                  </Drawer.Content>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.VirtualKeyboardProvider>
        </Drawer.Root>
      ));
      tick();
      await nextFrames();

      const viewport = screen.getByTestId("viewport");
      const scroll = screen.getByTestId("scroll");
      const input = screen.getByTestId("input");
      mockScrollGeometry(scroll, { top: 300, bottom: 720 });

      input.focus();
      visualViewport.resize(500);
      await nextFrames();
      await nextFrames();

      // 220px of overlap plus the 16px margin the container's own padding does not cover.
      expect(scroll.style.paddingBottom).toBe("236px");
      expect(scroll.style.scrollPaddingBottom).not.toBe("");
      expect(viewport.style.getPropertyValue("--drawer-keyboard-inset")).toBe("300px");

      input.blur();
      await nextFrames();
      await nextFrames();

      expect(scroll.style.paddingBottom).toBe("0px");
      expect(viewport.style.getPropertyValue("--drawer-keyboard-inset")).toBe("0px");
    } finally {
      visualViewport.restore();
      smallViewport.restore();
      restoreInnerHeight.restore();
    }
  });

  it("keeps the keyboard detected while the layout viewport resizes to the visual viewport", async () => {
    const innerHeight = mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);
    const smallViewport = mockSmallViewportHeight(800);

    try {
      const { dispose } = mount(() => (
        <Drawer.Root open modal={false}>
          <Drawer.VirtualKeyboardProvider>
            <Drawer.Portal>
              <Drawer.Viewport data-testid="viewport">
                <Drawer.Popup>
                  <Drawer.Content data-testid="scroll" style={{ height: "420px", "overflow-y": "auto", "padding-bottom": "0px" }}>
                    <div style={{ height: "900px" }} />
                    <input data-testid="input" type="text" />
                  </Drawer.Content>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.VirtualKeyboardProvider>
        </Drawer.Root>
      ));
      tick();
      await nextFrames();

      const viewport = screen.getByTestId("viewport");
      const scroll = screen.getByTestId("scroll");
      const input = screen.getByTestId("input");
      mockScrollGeometry(scroll, { top: 300, bottom: 720 });

      input.focus();
      visualViewport.resize(500);
      await nextFrames();
      await nextFrames();

      expect(scroll.style.paddingBottom).toBe("236px");
      expect(viewport.style.getPropertyValue("--drawer-keyboard-inset")).toBe("300px");
      const probe = Array.from(document.body.children).find((child) => isSmallViewportProbe(child as HTMLElement));
      expect(probe).not.toBeUndefined();

      // New Chrome on iOS shrinks `svh` for the keyboard, then the layout viewport down
      // to the visual viewport. The keyboard stays detected from its remembered visual
      // height, but no inset is applied since fixed content already moved itself.
      smallViewport.set(500);
      innerHeight.resize(520);
      await nextFrames();
      await nextFrames();

      expect(scroll.style.paddingBottom).toBe("216px");
      expect(viewport.style.getPropertyValue("--drawer-keyboard-inset")).toBe("0px");

      dispose();
      expect(Array.from(document.body.children).find((child) => isSmallViewportProbe(child as HTMLElement))).toBeUndefined();
    } finally {
      visualViewport.restore();
      smallViewport.restore();
      innerHeight.restore();
    }
  });

  it("reapplies preventScroll on focus before focusin when focus moves between fields", async () => {
    const restoreInnerHeight = mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);
    const smallViewport = mockSmallViewportHeight(800);

    try {
      mount(() => (
        <Drawer.Root open modal={false}>
          <Drawer.VirtualKeyboardProvider>
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup>
                  <input data-testid="first" type="text" />
                  <input data-testid="second" type="text" />
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.VirtualKeyboardProvider>
        </Drawer.Root>
      ));
      tick();
      await nextFrames();

      const first = screen.getByTestId("first") as HTMLInputElement;
      const second = screen.getByTestId("second") as HTMLInputElement;

      visualViewport.resize(500);
      first.focus();
      await nextFrames();

      const focusSpy = vi.spyOn(second, "focus");
      const onFocus = vi.fn();
      second.addEventListener("focus", onFocus);
      let optionsDuringFocusIn: FocusOptions | undefined;
      second.addEventListener("focusin", () => {
        optionsDuringFocusIn = focusSpy.mock.lastCall?.[0];
      });

      try {
        // Simulates the iOS keyboard's next-field arrow: focus moves with no touch events.
        first.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: second }));
        second.focus();
        tick();

        expect(second.style.transform).toBe("");
        expect(second.style.opacity).toBe("");
        // The iOS 27 native focus request is recorded between focus and focusin.
        // Protect it during focus without emitting another focus/blur cycle.
        expect(optionsDuringFocusIn).toEqual({ preventScroll: true });
        expect(focusSpy).toHaveBeenCalledTimes(2);
        expect(onFocus).toHaveBeenCalledTimes(1);
        expect(second).toHaveFocus();
      } finally {
        focusSpy.mockRestore();
      }
    } finally {
      visualViewport.restore();
      smallViewport.restore();
      restoreInnerHeight.restore();
    }
  });

  // jsdom rejects `view` in PointerEvent/MouseEvent constructors, which the tap-click
  // redispatch requires; exercise the full tap path in a real browser instead.
  it.skipIf(isJSDOM)("reapplies preventScroll after label activation focuses its control", async () => {
    try {
      mount(() => (
        <Drawer.Root open modal={false}>
          <Drawer.VirtualKeyboardProvider>
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup initialFocus={false}>
                  <label data-testid="label">
                    <span data-testid="label-text">Note</span>
                    <input data-testid="input" type="text" />
                  </label>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.VirtualKeyboardProvider>
        </Drawer.Root>
      ));
      tick();
      await nextFrames();

      const input = screen.getByTestId("input") as HTMLInputElement;
      const labelText = screen.getByTestId("label-text");
      expect(input).not.toHaveFocus();

      const focusSpy = vi.spyOn(input, "focus");
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      input.addEventListener("focus", onFocus);
      input.addEventListener("blur", onBlur);
      const restoreElementFromPoint = mockElementFromPoint(labelText);

      try {
        dispatchTouch(labelText, "touchstart", [{ clientX: 24, clientY: 48 }]);
        const touchEnd = dispatchTouch(labelText, "touchend", [{ clientX: 24, clientY: 48 }]);
        tick();

        expect(touchEnd.defaultPrevented).toBe(true);
        expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
        // The label default action refocuses without preventScroll after forwarding
        // the click. Reapply it after activation without emitting a new focus/blur cycle.
        expect(focusSpy).toHaveBeenCalledTimes(2);
        expect(focusSpy).toHaveBeenLastCalledWith({ preventScroll: true });
        expect(onFocus).toHaveBeenCalledTimes(1);
        expect(onBlur).not.toHaveBeenCalled();
        expect(input).toHaveFocus();
      } finally {
        restoreElementFromPoint();
        focusSpy.mockRestore();
      }
    } finally {
      // No window mocks in this test; kept symmetric for future edits.
    }
  });

  it.each([false, true])("releases keyboard inset and scroll slack after focus leaves the field (pointerdown: %s)", async (pointerDown) => {
    const restoreInnerHeight = mockWindowInnerHeight(800);
    const visualViewport = mockVisualViewport(800);
    const smallViewport = mockSmallViewportHeight(800);

    try {
      mount(() => (
        <Drawer.Root open modal={false}>
          <Drawer.VirtualKeyboardProvider>
            <Drawer.Portal>
              <Drawer.Viewport data-testid="viewport">
                <Drawer.Popup>
                  <Drawer.Content data-testid="scroll" style={{ height: "420px", "overflow-y": "auto", "padding-bottom": "20px" }}>
                    <input data-testid="input" type="text" />
                    <div style={{ height: "900px" }} />
                    <button data-testid="item" type="button" />
                  </Drawer.Content>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.VirtualKeyboardProvider>
        </Drawer.Root>
      ));
      tick();
      await nextFrames();

      const viewport = screen.getByTestId("viewport");
      const scroll = screen.getByTestId("scroll");
      const input = screen.getByTestId("input") as HTMLInputElement;
      const item = screen.getByTestId("item") as HTMLButtonElement;
      mockScrollGeometry(scroll, { top: 300, bottom: 720 });

      input.focus();
      visualViewport.resize(500);
      await nextFrames();
      await nextFrames();

      // 220px of overlap plus the container's own 20px padding, which already covers the margin.
      expect(scroll.style.paddingBottom).toBe("240px");

      // Scroll into the slack, where removing it would clamp the scroll position.
      scroll.scrollTop = scroll.scrollHeight;
      const scrollTop = scroll.scrollTop;
      const paddingBottom = scroll.style.paddingBottom;
      const inset = viewport.style.getPropertyValue("--drawer-keyboard-inset");

      // A tap's `mousedown` moves focus, and its `mouseup` and `click` are hit-tested at the
      // same point in the same task, so nothing under the finger may move synchronously.
      if (pointerDown) {
        // A consumer can move focus before pointerdown reaches the provider. The touch
        // pointer type keeps the viewport from starting a swipe off the synthetic press.
        window.addEventListener("pointerdown", () => item.focus(), { capture: true, once: true });
        item.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10, pointerType: "touch" }));
      } else {
        item.focus();
      }

      expect(scroll.style.paddingBottom).toBe(paddingBottom);
      expect(scroll.scrollTop).toBe(scrollTop);
      expect(viewport.style.getPropertyValue("--drawer-keyboard-inset")).toBe(inset);

      await nextFrames();
      await nextFrames();

      expect(scroll.style.paddingBottom).toBe("20px");
      expect(viewport.style.getPropertyValue("--drawer-keyboard-inset")).toBe("0px");
    } finally {
      visualViewport.restore();
      smallViewport.restore();
      restoreInnerHeight.restore();
    }
  });
});
