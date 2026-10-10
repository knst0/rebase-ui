import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { dispatchClickWithModifiers } from "./dispatchClickWithModifiers";

describe("dispatchClickWithModifiers", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("forwards detail, pointerType, and modifier state to the synthetic click", () => {
    const target = document.createElement("button");
    document.body.appendChild(target);

    const seen: Array<{ detail: number; pointerType: string; shiftKey: boolean; ctrlKey: boolean }> = [];
    const OriginalPointerEvent = target.ownerDocument.defaultView?.PointerEvent;
    // jsdom has no PointerEvent; install a capturing stand-in so the init dict is observable.
    const initSeen: PointerEventInit[] = [];
    class FakePointerEvent extends MouseEvent {
      pointerType = "";
      constructor(type: string, init?: PointerEventInit) {
        super(type, init);
        initSeen.push(init ?? {});
        this.pointerType = init?.pointerType ?? "";
      }
    }
    Object.defineProperty(target.ownerDocument.defaultView, "PointerEvent", {
      value: FakePointerEvent,
      configurable: true,
      writable: true,
    });

    try {
      target.addEventListener("click", (event) => {
        seen.push({
          detail: (event as MouseEvent).detail,
          pointerType: (event as PointerEvent).pointerType ?? "",
          shiftKey: (event as MouseEvent).shiftKey,
          ctrlKey: (event as MouseEvent).ctrlKey,
        });
      });

      dispatchClickWithModifiers(
        target,
        { shiftKey: true, ctrlKey: false, altKey: false, metaKey: false },
        { detail: 1, pointerType: "mouse" },
      );

      expect(seen).toEqual([{ detail: 1, pointerType: "mouse", shiftKey: true, ctrlKey: false }]);
      expect(initSeen[0]?.pointerType).toBe("mouse");
      expect(initSeen[0]?.detail).toBe(1);
    } finally {
      Object.defineProperty(target.ownerDocument.defaultView, "PointerEvent", {
        value: OriginalPointerEvent,
        configurable: true,
        writable: true,
      });
    }
  });

  it("defaults to keyboard-click conventions (detail 0, empty pointerType)", () => {
    const target = document.createElement("button");
    document.body.appendChild(target);

    const seen: MouseEvent[] = [];
    target.addEventListener("click", (event) => {
      seen.push(event as MouseEvent);
    });

    dispatchClickWithModifiers(target, { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false });

    expect(seen).toHaveLength(1);
    expect(seen[0]?.detail).toBe(0);
  });
});
