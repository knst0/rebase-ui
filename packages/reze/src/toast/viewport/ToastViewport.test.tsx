import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import * as Toast from "../index.parts";
import { useToastProviderContext } from "../provider/ToastProviderContext";
import type { ToastStore } from "../store/ToastStore";

afterEach(cleanup);

function renderViewport() {
  let store!: ToastStore;

  function CaptureStore() {
    store = useToastProviderContext();
    return null;
  }

  mount(() => (
    <Toast.Provider>
      <CaptureStore />
      <Toast.Viewport data-testid="viewport" />
      <button type="button">add</button>
    </Toast.Provider>
  ));
  tick();

  return {
    store: () => store,
    viewport: () => screen.getByTestId("viewport") as HTMLElement,
    outside: () => screen.getByRole("button", { name: "add" }) as HTMLElement,
  };
}

function mouseEnter(element: Element) {
  element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: true }));
}

function mouseLeave(element: Element, relatedTarget: Element | null = document.body) {
  element.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false, cancelable: true, relatedTarget }));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<Toast.Viewport />", () => {
  it.each(["hovering", "focused"] as const)(
    "keeps timers paused while still %s after the other interaction ends",
    (remainingInteraction) => {
      const ui = renderViewport();
      const store = ui.store();
      const id = store.addToast({ title: "hello", timeout: 5000 });
      tick();
      vi.advanceTimersByTime(1000);

      // Focus the viewport with F6, then hover it: both interactions pause the timers.
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "F6", bubbles: true }));
      tick();
      expect(store.peek("focused")).toBe(true);

      const viewport = ui.viewport();
      mouseEnter(viewport);
      tick();
      expect(store.peekState().hovering).toBe(true);

      if (remainingInteraction === "hovering") {
        fire(viewport, "blur", { relatedTarget: ui.outside() } as FocusEventInit);
      } else {
        mouseLeave(viewport);
      }
      tick();

      // The full timeout elapses while one interaction is still active: the toast survives.
      vi.advanceTimersByTime(5001);
      expect(store.peek("toast", id).transitionStatus).toBe("starting");

      if (remainingInteraction === "hovering") {
        mouseLeave(viewport);
      } else {
        fire(viewport, "blur", { relatedTarget: ui.outside() } as FocusEventInit);
      }
      tick();

      // Only the time remaining from before the pause is left once timers resume.
      vi.advanceTimersByTime(3999);
      expect(store.peek("toast", id).transitionStatus).toBe("starting");

      vi.advanceTimersByTime(2);
      expect(store.peek("toast", id).transitionStatus).toBe("ending");
    },
  );

  it("announces high-priority toasts in assertive live regions", () => {
    const ui = renderViewport();
    const store = ui.store();
    store.addToast({ title: "urgent", description: "read now", priority: "high", timeout: 0 });
    tick();

    const alert = document.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("urgent");
    expect(alert).toHaveTextContent("read now");
    expect(ui.viewport().getAttribute("aria-live")).toBe("polite");
  });
});
