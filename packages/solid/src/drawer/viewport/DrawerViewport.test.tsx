import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import type { JSX } from "@solidjs/web";
import userEvent from "@testing-library/user-event";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Drawer from "../index.parts";

interface TouchPoint {
  clientX: number;
  clientY: number;
}

function dispatchTouch(target: EventTarget, type: "touchstart" | "touchmove" | "touchend" | "touchcancel", touches: TouchPoint[]) {
  const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
  Object.defineProperty(event, "touches", { value: touches });
  Object.defineProperty(event, "changedTouches", { value: touches });
  return target.dispatchEvent(event);
}

function dispatchPointer(
  target: EventTarget,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  init: { button?: number; buttons?: number; pointerId?: number; clientX?: number; clientY?: number; pointerType?: string },
) {
  const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
  for (const [key, value] of Object.entries(init)) {
    Object.defineProperty(event, key, { value });
  }
  return target.dispatchEvent(event);
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

describe("<Drawer.Viewport />", () => {
  it("provides the viewport context to <Drawer.Popup /> rendered inside it", async () => {
    const viewportErrors: unknown[][] = [];
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("<Drawer.Viewport>")) {
        viewportErrors.push(args);
      }
    });

    try {
      render(() => (
        <Drawer.Root>
          <Drawer.Trigger>Open drawer</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup">
                <Drawer.Title>Drawer title</Drawer.Title>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Open drawer" }));
      flush();
      await nextFrames();

      expect(screen.queryByTestId("popup")).toBeInTheDocument();
      expect(viewportErrors).toEqual([]);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("registers the non-passive document touchmove listener only while open", async () => {
    const activeListeners = new Set<EventListenerOrEventListenerObject>();
    const originalAdd = document.addEventListener.bind(document);
    const originalRemove = document.removeEventListener.bind(document);
    document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: unknown) => {
      if (
        type === "touchmove" &&
        typeof options === "object" &&
        options !== null &&
        (options as AddEventListenerOptions).passive === false
      ) {
        activeListeners.add(listener as EventListenerOrEventListenerObject);
      }
      return originalAdd(type as never, listener as never, options as never);
    }) as typeof document.addEventListener;
    document.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: unknown) => {
      if (type === "touchmove") {
        activeListeners.delete(listener as EventListenerOrEventListenerObject);
      }
      return originalRemove(type as never, listener as never, options as never);
    }) as typeof document.removeEventListener;

    try {
      const [open, setOpen] = createSignal(false);
      render(() => (
        <Drawer.Root open={open()}>
          <Drawer.Portal keepMounted>
            <Drawer.Viewport>
              <Drawer.Popup>Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));
      flush();
      await nextFrames();
      expect(activeListeners.size).toBe(0);

      setOpen(true);
      flush();
      await nextFrames();
      expect(activeListeners.size).toBe(1);

      setOpen(false);
      flush();
      await nextFrames();
      expect(activeListeners.size).toBe(0);
    } finally {
      document.addEventListener = originalAdd as typeof document.addEventListener;
      document.removeEventListener = originalRemove as typeof document.removeEventListener;
    }
  });

  it("scrolls instead of swiping when a touch drag starts on an SVG inside scrolled content", async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ "overflow-y": "auto", "max-height": "40px" }}>
                <svg width={20} height={20}>
                  <rect data-testid="rect" width={20} height={20} />
                </svg>
                <div style={{ height: "120px" }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    flush();
    await nextFrames();

    const scroll = screen.getByTestId("scroll");
    const rect = screen.getByTestId("rect");
    const backdrop = screen.getByTestId("backdrop");

    Object.defineProperty(scroll, "scrollHeight", { value: 160, configurable: true });
    Object.defineProperty(scroll, "clientHeight", { value: 40, configurable: true });
    scroll.scrollTop = 40;

    const restoreElementFromPoint = mockElementFromPoint(rect);
    try {
      dispatchTouch(rect, "touchstart", [{ clientX: 0, clientY: 0 }]);
      const prevented = !dispatchTouch(rect, "touchmove", [{ clientX: 0, clientY: 40 }]);
      flush();

      expect(prevented).toBe(false);
      expect(backdrop).not.toHaveAttribute("data-swiping");
    } finally {
      restoreElementFromPoint();
    }
  });

  it("does not start a mouse drag swipe from an SVG inside scrollable content", async () => {
    render(() => (
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>
              <div data-testid="scroll" style={{ "overflow-y": "auto", "max-height": "40px" }}>
                <svg width={20} height={20}>
                  <rect data-testid="rect" width={20} height={20} />
                </svg>
                <div style={{ height: "120px" }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    flush();
    await nextFrames();

    const viewport = screen.getByTestId("viewport");
    const scroll = screen.getByTestId("scroll");
    const rect = screen.getByTestId("rect");
    const backdrop = screen.getByTestId("backdrop");

    Object.defineProperty(scroll, "scrollHeight", { value: 160, configurable: true });
    Object.defineProperty(scroll, "clientHeight", { value: 40, configurable: true });

    const restoreElementFromPoint = mockElementFromPoint(rect);
    try {
      dispatchPointer(rect, "pointerdown", { button: 0, buttons: 1, pointerId: 1, clientX: 0, clientY: 0, pointerType: "mouse" });
      dispatchPointer(viewport, "pointermove", { pointerId: 1, buttons: 1, clientX: 0, clientY: 40, pointerType: "mouse" });
      flush();

      expect(backdrop).not.toHaveAttribute("data-swiping");
    } finally {
      restoreElementFromPoint();
    }
  });

  it("dismisses with a touch swipe down that starts on an SVG inside a top-edge scroll container", async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ "overflow-y": "auto", "max-height": "40px" }}>
                <svg width={20} height={20}>
                  <rect data-testid="rect" width={20} height={20} />
                </svg>
                <div style={{ height: "120px" }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    flush();
    await nextFrames();

    const scroll = screen.getByTestId("scroll");
    const rect = screen.getByTestId("rect");
    const backdrop = screen.getByTestId("backdrop");
    const popup = screen.getByTestId("popup");
    Object.defineProperty(scroll, "scrollHeight", { value: 160, configurable: true });
    Object.defineProperty(scroll, "clientHeight", { value: 40, configurable: true });
    scroll.scrollTop = 0;

    Object.defineProperty(popup, "offsetHeight", { value: 200, configurable: true });

    const restoreElementFromPoint = mockElementFromPoint(rect);
    try {
      dispatchTouch(rect, "touchstart", [{ clientX: 0, clientY: 0 }]);
      dispatchTouch(rect, "touchmove", [{ clientX: 0, clientY: 140 }]);
      flush();

      expect(backdrop).toHaveAttribute("data-swiping", "");

      dispatchTouch(rect, "touchend", [{ clientX: 0, clientY: 140 }]);
      flush();
    } finally {
      restoreElementFromPoint();
    }

    expect(handleOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "swipe" }));
  });

  describe("data-base-ui-swipe-ignore axis values", () => {
    function renderAxisDrawer(
      swipeDirection: "down" | "right",
      children: JSX.Element,
      handleOpenChange: Drawer.Root.Props["onOpenChange"],
    ) {
      render(() => (
        <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection={swipeDirection}>
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">{children}</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));
      flush();
    }

    function swipe(target: HTMLElement, points: TouchPoint[]) {
      const restoreElementFromPoint = mockElementFromPoint(target);
      try {
        dispatchTouch(target, "touchstart", [{ clientX: 100, clientY: 100 }]);
        return points.map((point) => dispatchTouch(target, "touchmove", [point]));
      } finally {
        restoreElementFromPoint();
      }
    }

    function endSwipe(target: HTMLElement, point: TouchPoint) {
      dispatchTouch(target, "touchend", [point]);
      flush();
    }

    it.each([
      ["down", "y", { clientX: 100, clientY: 140 }],
      ["right", "x", { clientX: 140, clientY: 100 }],
    ] as const)("ignores %s touch swipes from elements with the drawer axis value %s", async (swipeDirection, axis, end) => {
      const handleOpenChange = vi.fn();
      renderAxisDrawer(
        swipeDirection,
        <div data-testid="target" data-base-ui-swipe-ignore={axis}>
          Carousel
        </div>,
        handleOpenChange,
      );
      await nextFrames();

      const target = screen.getByTestId("target");
      expect(swipe(target, [end])).toEqual([true]);
      expect(screen.getByTestId("backdrop")).not.toHaveAttribute("data-swiping");

      endSwipe(target, end);
      await nextFrames();

      expect(handleOpenChange).not.toHaveBeenCalled();
    });

    it.each([
      ["down", "x", { clientX: 103, clientY: 101 }, { clientX: 140, clientY: 104 }],
      ["right", "y", { clientX: 101, clientY: 103 }, { clientX: 104, clientY: 140 }],
    ] as const)(
      "hands cross-axis drags in %s drawers to elements with the value %s",
      async (swipeDirection, axis, ambiguous, crossAxis) => {
        const handleOpenChange = vi.fn();
        renderAxisDrawer(
          swipeDirection,
          <div data-testid="target" data-base-ui-swipe-ignore={axis}>
            Carousel
          </div>,
          handleOpenChange,
        );
        await nextFrames();

        const target = screen.getByTestId("target");
        const popup = screen.getByTestId("popup");
        const handleTargetTouchMove = vi.fn();
        target.addEventListener("touchmove", handleTargetTouchMove);
        expect(swipe(target, [ambiguous, crossAxis])).toEqual([true, true]);
        expect(handleTargetTouchMove).toHaveBeenCalledTimes(2);
        expect(popup.style.getPropertyValue("--drawer-swipe-movement-x")).toBe("0px");
        expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("0px");

        endSwipe(target, crossAxis);
        await nextFrames();

        expect(handleOpenChange).not.toHaveBeenCalled();
      },
    );

    it.each(["marked", "scrollable"] as const)(
      "does not swipe or settle snap points while a %s cross-axis target handles the drag",
      async (kind) => {
        const handleSnapPointChange = vi.fn();
        render(() => (
          <Drawer.Root open snapPoints={[200, 360]} onSnapPointChange={handleSnapPointChange}>
            <Drawer.Portal>
              <Drawer.Backdrop data-testid="backdrop" />
              <Drawer.Viewport>
                <Drawer.Popup data-testid="popup">
                  <div
                    data-testid="target"
                    data-base-ui-swipe-ignore={kind === "marked" ? "x" : undefined}
                    style={kind === "scrollable" ? { "overflow-x": "auto" } : undefined}
                  >
                    Carousel
                  </div>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        ));
        flush();
        await nextFrames();

        const target = screen.getByTestId("target");
        if (kind === "scrollable") {
          Object.defineProperty(target, "scrollWidth", { value: 400, configurable: true });
          Object.defineProperty(target, "clientWidth", { value: 100, configurable: true });
        }

        const crossAxis = { clientX: 140, clientY: 104 };
        expect(swipe(target, [{ clientX: 103, clientY: 101 }, crossAxis])).toEqual([true, true]);
        expect(screen.getByTestId("backdrop")).not.toHaveAttribute("data-swiping");
        expect(screen.getByTestId("popup")).not.toHaveAttribute("data-swiping");

        endSwipe(target, crossAxis);
        await nextFrames();

        expect(handleSnapPointChange).not.toHaveBeenCalled();
      },
    );

    it.each([
      [
        "down",
        "x",
        [
          { clientX: 101, clientY: 103 },
          { clientX: 102, clientY: 140 },
          { clientX: 102, clientY: 200 },
        ],
      ],
      [
        "right",
        "y",
        [
          { clientX: 103, clientY: 101 },
          { clientX: 140, clientY: 102 },
          { clientX: 200, clientY: 102 },
        ],
      ],
    ] as const)("still swipes %s drawers from elements with the cross-axis value %s", async (swipeDirection, axis, points) => {
      const handleOpenChange = vi.fn();
      renderAxisDrawer(
        swipeDirection,
        <div data-testid="target" data-base-ui-swipe-ignore={axis}>
          Carousel
        </div>,
        handleOpenChange,
      );
      await nextFrames();

      const target = screen.getByTestId("target");
      expect(swipe(target, [...points])).toEqual([true, false, false]);

      endSwipe(target, points[2]);
      await nextFrames();

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      expect(handleOpenChange.mock.calls[0][0]).toBe(false);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe("swipe");
    });

    it("keeps an ancestor that ignores all directions in effect over a nested axis value", async () => {
      const handleOpenChange = vi.fn();
      renderAxisDrawer(
        "down",
        <div data-base-ui-swipe-ignore>
          <div data-testid="target" data-base-ui-swipe-ignore="x">
            Carousel
          </div>
        </div>,
        handleOpenChange,
      );
      await nextFrames();

      const target = screen.getByTestId("target");
      const end = { clientX: 100, clientY: 140 };
      expect(swipe(target, [end])).toEqual([true]);

      endSwipe(target, end);
      await nextFrames();

      expect(handleOpenChange).not.toHaveBeenCalled();
    });
  });
});
