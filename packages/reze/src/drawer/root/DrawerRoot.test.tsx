import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { signal } from "reze-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";

import { createDrawerHandle } from "../handle";
import * as Drawer from "../index.parts";

afterEach(cleanup);

const isJSDOM = window.navigator.userAgent.includes("jsdom");

function renderDrawer(rootProps: Drawer.Root.Props = {}) {
  mount(() => (
    <Drawer.Root {...rootProps}>
      <Drawer.Trigger>Open drawer</Drawer.Trigger>
      <button type="button">Outside</button>
      <Drawer.Portal>
        <Drawer.Backdrop data-testid="backdrop" />
        <Drawer.Viewport data-testid="viewport">
          <Drawer.Popup data-testid="popup">
            <Drawer.Title>Drawer title</Drawer.Title>
            <Drawer.Description>Drawer description</Drawer.Description>
            <Drawer.Content data-testid="content">Body</Drawer.Content>
            <Drawer.Close>Close drawer</Drawer.Close>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  ));

  return {
    trigger: screen.getByRole("button", { name: "Open drawer" }),
    outside: screen.getByRole("button", { name: "Outside" }),
    popup: () => screen.queryByTestId("popup"),
    backdrop: () => screen.queryByTestId("backdrop"),
    viewport: () => screen.queryByTestId("viewport"),
    content: () => screen.queryByTestId("content"),
  };
}

async function openViaTrigger(trigger: HTMLElement) {
  const user = userEvent.setup();
  await user.click(trigger);
  tick();
  await nextFrames();
  return user;
}

describe("<Drawer.Root />", () => {
  it("opens when the trigger is clicked and closes when the close button is clicked", async () => {
    const { trigger, popup } = renderDrawer();

    expect(popup()).toBeNull();

    await openViaTrigger(trigger);

    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close drawer" }));
    tick();
    await nextFrames();

    expect(popup()).toBeNull();
  });

  it("reads no reactive values outside a tracking scope while opening and closing", async () => {
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
      const { trigger, popup } = renderDrawer();

      await openViaTrigger(trigger);
      expect(popup()).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Close drawer" }));
      tick();
      await nextFrames();

      expect(popup()).toBeNull();
      expect(diagnostics).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("sets dialog semantics with title and description labelling", async () => {
    const { trigger, popup } = renderDrawer();

    await openViaTrigger(trigger);

    const popupElement = popup()!;
    expect(popupElement).toHaveAttribute("role", "dialog");
    expect(popupElement).toHaveAttribute("aria-modal", "true");

    const labelledBy = popupElement.getAttribute("aria-labelledby");
    const describedBy = popupElement.getAttribute("aria-describedby");
    expect(document.getElementById(labelledBy!)).toHaveTextContent("Drawer title");
    expect(document.getElementById(describedBy!)).toHaveTextContent("Drawer description");
  });

  it("exposes the swipe direction and swipe css vars on the popup", async () => {
    const { trigger, popup } = renderDrawer({ swipeDirection: "left" });

    await openViaTrigger(trigger);

    const popupElement = popup()!;
    expect(popupElement).toHaveAttribute("data-swipe-direction", "left");
    expect(popupElement.style.getPropertyValue("--drawer-swipe-movement-x")).toBe("0px");
    expect(popupElement.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("0px");
    expect(popupElement.style.getPropertyValue("--drawer-snap-point-offset")).toBe("0px");
    expect(popupElement.style.getPropertyValue("--drawer-swipe-strength")).toBe("1");
    expect(popupElement.style.getPropertyValue("--drawer-swipe-progress")).toBe("0");
  });

  it("marks the content element with the drawer content attribute", async () => {
    const { trigger, content } = renderDrawer();

    await openViaTrigger(trigger);

    expect(content()).toHaveAttribute("data-drawer-content", "");
  });

  it("opens inside Drawer.Indent without recreating the root subtree", async () => {
    mount(() => (
      <Drawer.Indent data-testid="indent">
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
      </Drawer.Indent>
    ));

    const trigger = screen.getByRole("button", { name: "Open drawer" });
    expect(screen.queryByTestId("popup")).toBeNull();

    await openViaTrigger(trigger);

    // Opening must not re-resolve the indent children (which would recreate the
    // root with a fresh store): the popup mounts on the store the trigger wrote to.
    expect(screen.queryByTestId("popup")).toBeInTheDocument();
    expect(screen.queryByTestId("indent")).toHaveAttribute("data-inactive", "");
  });

  it("closes on Escape and reports the reason", async () => {
    const onOpenChange = vi.fn();
    const { trigger, popup } = renderDrawer({ onOpenChange });

    await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.keyboard("{Escape}");
    tick();
    await nextFrames();

    expect(popup()).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "escape-key" }));
  });

  it("supports controlled open state", async () => {
    const onOpenChange = vi.fn();
    const { trigger, popup } = renderDrawer({ open: true, onOpenChange });

    tick();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    // Clicking the trigger requests close but the controlled prop keeps it open.
    const user = userEvent.setup();
    await user.click(trigger);
    tick();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "trigger-press" }));
  });

  it("resets to the default snap point when closed", async () => {
    const onSnapPointChange = vi.fn();
    const { trigger, popup } = renderDrawer({ snapPoints: [0.5, 1], defaultSnapPoint: 0.5, onSnapPointChange });

    await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close drawer" }));
    tick();
    await nextFrames();

    expect(popup()).toBeNull();
    expect(onSnapPointChange).toHaveBeenCalledWith(0.5, expect.anything());
  });

  it("opens via a detached trigger using a handle", async () => {
    const handle = createDrawerHandle();

    mount(() => (
      <>
        <Drawer.Root handle={handle}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="handled-popup">
                <Drawer.Title>Handled</Drawer.Title>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
        <Drawer.Trigger handle={handle}>Detached open</Drawer.Trigger>
      </>
    ));

    expect(screen.queryByTestId("handled-popup")).toBeNull();

    await openViaTrigger(screen.getByRole("button", { name: "Detached open" }));

    expect(screen.queryByTestId("handled-popup")).toBeInTheDocument();
  });

  it("marks the parent popup when a nested drawer is open", async () => {
    mount(() => (
      <Drawer.Root defaultOpen>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="outer-popup">
              <Drawer.Title>Outer</Drawer.Title>
              <Drawer.Root defaultOpen>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="inner-popup">
                      <Drawer.Title>Inner</Drawer.Title>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    tick();
    await nextFrames();

    expect(screen.queryByTestId("outer-popup")).toBeInTheDocument();
    expect(screen.queryByTestId("inner-popup")).toBeInTheDocument();
    expect(screen.queryByTestId("outer-popup")).toHaveAttribute("data-nested-drawer-open", "");
  });

  describe("CloseWatcher", () => {
    class CloseWatcherStub extends EventTarget {
      static instances: CloseWatcherStub[] = [];
      active = true;

      constructor() {
        super();
        CloseWatcherStub.instances.push(this);
      }

      destroy() {
        this.active = false;
      }

      // Mirrors the browser: `cancel` fires first and can only be prevented while the page has
      // history-action activation; otherwise the watcher is destroyed before `close` fires.
      requestClose(cancelable: boolean) {
        if (!this.active) {
          return;
        }

        const cancelEvent = new Event("cancel", { cancelable });
        this.dispatchEvent(cancelEvent);
        if (cancelEvent.defaultPrevented) {
          return;
        }

        this.destroy();
        this.dispatchEvent(new Event("close"));
      }
    }

    const win = window as Window & { CloseWatcher?: unknown };
    const originalCloseWatcher = win.CloseWatcher;

    beforeEach(() => {
      CloseWatcherStub.instances = [];
      win.CloseWatcher = CloseWatcherStub;
      vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      );
    });

    afterEach(() => {
      win.CloseWatcher = originalCloseWatcher;
      vi.restoreAllMocks();
    });

    function TestDrawer(props: Omit<Drawer.Root.Props, "children">) {
      return (
        <Drawer.Root {...props}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      );
    }

    function currentWatcher() {
      return CloseWatcherStub.instances[CloseWatcherStub.instances.length - 1]!;
    }

    async function renderOpenDrawer(props: Omit<Drawer.Root.Props, "children"> = {}) {
      const result = mount(() => <TestDrawer defaultOpen {...props} />);
      tick();
      await nextFrames();
      return result;
    }

    async function requestClose(cancelable = true) {
      currentWatcher().requestClose(cancelable);
      tick();
      await nextFrames();
    }

    it("closes when the watcher requests a close", async () => {
      const handleOpenChange = vi.fn();
      await renderOpenDrawer({ onOpenChange: handleOpenChange });

      await requestClose();

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      expect(handleOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "close-watcher" }));
      expect(screen.queryByRole("dialog")).toBe(null);
      expect(currentWatcher().active).toBe(false);
    });

    it("keeps the same watcher active when a cancelable close request is canceled", async () => {
      let shouldCancel = true;
      const handleOpenChange = vi.fn((_open: boolean, details: Drawer.Root.ChangeEventDetails) => {
        if (shouldCancel) {
          details.cancel();
        }
      });
      await renderOpenDrawer({ onOpenChange: handleOpenChange });
      const watcher = currentWatcher();
      const instanceCount = CloseWatcherStub.instances.length;

      await requestClose();

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("dialog")).not.toBe(null);
      expect(CloseWatcherStub.instances).toHaveLength(instanceCount);
      expect(watcher.active).toBe(true);

      shouldCancel = false;
      await requestClose();

      expect(handleOpenChange).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("dialog")).toBe(null);
      expect(watcher.active).toBe(false);
    });

    it("closes on a close request that cannot be prevented even if onOpenChange cancels it", async () => {
      const handleOpenChange = vi.fn((_open: boolean, details: Drawer.Root.ChangeEventDetails) => {
        details.cancel();
      });
      await renderOpenDrawer({ onOpenChange: handleOpenChange });

      await requestClose(false);

      expect(handleOpenChange).toHaveBeenCalledTimes(1);
      const details = handleOpenChange.mock.calls[0][1] as Drawer.Root.ChangeEventDetails;
      expect(details.event.cancelable).toBe(false);
      expect(details.isCanceled).toBe(false);
      expect(screen.queryByRole("dialog")).toBe(null);
      expect(currentWatcher().active).toBe(false);
    });

    it("destroys the watcher on unmount", async () => {
      const handleOpenChange = vi.fn((_open: boolean, details: Drawer.Root.ChangeEventDetails) => {
        details.cancel();
      });
      const { dispose } = await renderOpenDrawer({ onOpenChange: handleOpenChange });
      const watcher = currentWatcher();

      await requestClose();
      expect(watcher.active).toBe(true);

      dispose();
      expect(watcher.active).toBe(false);
    });
  });
});

describe("<Drawer.Root /> snap point sequential swipe", () => {
  interface TimedSwipeStep {
    type: "down" | "move" | "up";
    x: number;
    y: number;
    time: number;
  }

  function SnapPointSequentialSkipCase() {
    const snapPoints: Drawer.Root.SnapPoint[] = ["100px", "300px", 1];
    let snapPoint = signal<Drawer.Root.SnapPoint | null>(snapPoints[0]);

    return (
      <div>
        <div data-testid="active-snap">{String(snapPoint)}</div>
        <Drawer.Root
          open
          snapPoints={snapPoints}
          snapPoint={snapPoint}
          onSnapPointChange={(next) => {
            snapPoint = next;
          }}
          swipeDirection="down"
          snapToSequentialPoints
        >
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport" style={{ height: "600px" }}>
              <Drawer.Popup data-testid="popup" style={{ height: "600px" }}>
                Drawer
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    );
  }

  function setupSwipeTestEnv() {
    const originalElementFromPoint = document.elementFromPoint?.bind(document);
    return {
      /** Call after rendering to point `elementFromPoint` at the given element. */
      pointAt(element: Element) {
        document.elementFromPoint = () => element;
      },
      cleanup() {
        if (originalElementFromPoint === undefined) {
          Reflect.deleteProperty(document, "elementFromPoint");
        } else {
          document.elementFromPoint = originalElementFromPoint;
        }
      },
    };
  }

  function mockLayoutForJSDOM() {
    // DOM emulation has no layout, and the snap math reads `offsetHeight` when the drawer
    // mounts — synchronously during mount, before per-element mocks could land. Gate the mock
    // to the snap-case elements so the rest of the document keeps real geometry. A real
    // browser resolves 600 from the inline styles instead, so the same value applies there.
    if (!isJSDOM && typeof navigator !== "undefined" && !/happy-?dom/i.test(navigator.userAgent ?? "")) {
      return () => {};
    }
    const prototype = HTMLElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "offsetHeight");
    Object.defineProperty(prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        const testId = this.dataset?.testid;
        if (testId === "viewport" || testId === "popup") {
          return 600;
        }
        // jsdom has no layout and reports 0; per-element own-property mocks (if any)
        // shadow this prototype getter, so they keep working.
        return 0;
      },
    });
    return () => {
      if (descriptor) {
        Object.defineProperty(prototype, "offsetHeight", descriptor);
      } else {
        Reflect.deleteProperty(prototype, "offsetHeight");
      }
    };
  }

  function neutralizePointerCapture(element: HTMLElement) {
    // Synthetic pointer ids are not active pointers; capture is irrelevant to snap decisions.
    for (const method of ["setPointerCapture", "releasePointerCapture"] as const) {
      if (typeof element[method] === "function") {
        element[method] = () => {};
      }
    }
  }

  async function renderSnapCase() {
    const env = setupSwipeTestEnv();
    const restoreLayout = mockLayoutForJSDOM();
    mount(() => <SnapPointSequentialSkipCase />);
    const viewport = screen.getByTestId("viewport");
    const popup = screen.getByTestId("popup");
    neutralizePointerCapture(popup);
    tick();
    await nextFrames();
    env.pointAt(popup);
    // Snap resolution worked: the active `100px` point sits at offset 600 - 100.
    expect(popup.style.getPropertyValue("--drawer-snap-point-offset")).toBe("500px");
    return { env, restoreLayout, viewport };
  }

  async function simulateTimedSwipe(element: HTMLElement, steps: TimedSwipeStep[]) {
    // Every step carries its own `timeStamp`, so the gesture timeline no longer depends on the wall clock.
    for (const step of steps) {
      const type = step.type === "down" ? "pointerdown" : step.type === "move" ? "pointermove" : "pointerup";
      const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
      const init: Record<string, unknown> = {
        button: 0,
        buttons: step.type === "up" ? 0 : 1,
        pointerId: 1,
        pointerType: "mouse",
        clientX: step.x,
        clientY: step.y,
        timeStamp: step.time,
      };
      for (const [key, value] of Object.entries(init)) {
        Object.defineProperty(event, key, { value });
      }
      element.dispatchEvent(event);
      tick();
    }
    await nextFrames();
  }

  it.each([false, true])("advances on a short flick with a trailing stationary sample: %s", async (phantom) => {
    const { env, restoreLayout, viewport } = await renderSnapCase();

    try {
      expect(screen.getByTestId("active-snap").textContent).toBe("100px");

      await simulateTimedSwipe(viewport, [
        { type: "down", x: 100, y: 500, time: 992 },
        { type: "move", x: 100, y: 500, time: 1000 },
        { type: "move", x: 100, y: 488, time: 1016 },
        { type: "move", x: 100, y: 476, time: 1032 },
        { type: "move", x: 100, y: 464, time: 1048 },
        ...(phantom ? [{ type: "move" as const, x: 100, y: 463.5, time: 1064 }] : []),
        { type: "up", x: 100, y: phantom ? 463.5 : 464, time: phantom ? 1072 : 1056 },
      ]);

      expect(screen.getByTestId("active-snap").textContent).toBe("300px");
    } finally {
      env.cleanup();
      restoreLayout();
    }
  });

  it("stays on the current snap point after repeated stationary samples", async () => {
    const { env, restoreLayout, viewport } = await renderSnapCase();

    try {
      expect(screen.getByTestId("active-snap").textContent).toBe("100px");

      await simulateTimedSwipe(viewport, [
        { type: "down", x: 100, y: 500, time: 992 },
        { type: "move", x: 100, y: 500, time: 1000 },
        { type: "move", x: 100, y: 460, time: 1016 },
        { type: "move", x: 100, y: 460, time: 1032 },
        { type: "move", x: 100, y: 460, time: 1048 },
        { type: "move", x: 100, y: 460, time: 1064 },
        { type: "up", x: 100, y: 460, time: 1072 },
      ]);

      expect(screen.getByTestId("active-snap").textContent).toBe("100px");
    } finally {
      env.cleanup();
      restoreLayout();
    }
  });
});
