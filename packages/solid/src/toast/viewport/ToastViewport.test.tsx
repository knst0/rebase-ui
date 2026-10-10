import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import * as Toast from "../index.parts";
import { useToastProviderContext } from "../provider/ToastProviderContext";
import type { ToastStore } from "../store/ToastStore";

function renderViewport() {
  let store!: ToastStore;

  function CaptureStore() {
    store = useToastProviderContext();
    return null;
  }

  render(() => (
    <Toast.Provider>
      <CaptureStore />
      <Toast.Viewport data-testid="viewport" />
      <button type="button">add</button>
    </Toast.Provider>
  ));
  flush();

  return {
    store: () => store,
    viewport: () => screen.getByTestId("viewport") as HTMLElement,
    outside: () => screen.getByRole("button", { name: "add" }) as HTMLElement,
  };
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
      flush();
      vi.advanceTimersByTime(1000);

      // Focus the viewport with F6, then hover it: both interactions pause the timers.
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "F6", bubbles: true }));
      flush();
      expect(store.peek("focused")).toBe(true);

      const viewport = ui.viewport();
      fireEvent.mouseEnter(viewport);
      flush();
      expect(store.peekState().hovering).toBe(true);

      if (remainingInteraction === "hovering") {
        fireEvent.blur(viewport, { relatedTarget: ui.outside() });
      } else {
        fireEvent.mouseLeave(viewport);
      }
      flush();

      // The full timeout elapses while one interaction is still active: the toast survives.
      vi.advanceTimersByTime(5001);
      expect(store.peek("toast", id).transitionStatus).toBe("starting");

      if (remainingInteraction === "hovering") {
        fireEvent.mouseLeave(viewport);
      } else {
        fireEvent.blur(viewport, { relatedTarget: ui.outside() });
      }
      flush();

      // Only the time remaining from before the pause is left once timers resume.
      vi.advanceTimersByTime(3999);
      expect(store.peek("toast", id).transitionStatus).toBe("starting");

      vi.advanceTimersByTime(2);
      expect(store.peek("toast", id).transitionStatus).toBe("ending");
    },
  );
});
