import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FloatingRootStore } from "../tree/FloatingRootStore";
import type { TriggerElementsMap } from "../types";
import { FloatingFocusManager } from "./FloatingFocusManager";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function createTriggerMap(): TriggerElementsMap {
  const map = new Map<string, Element>();
  return {
    add: (id, element) => {
      map.set(id, element);
    },
    delete: (id) => {
      map.delete(id);
    },
    hasElement: (element) => [...map.values()].includes(element),
    entries: () => map.entries(),
  };
}

function createStore(
  options: {
    open?: boolean | undefined;
    referenceElement?: Element | null | undefined;
    floatingElement?: HTMLElement | null | undefined;
  } = {},
) {
  return new FloatingRootStore({
    open: options.open ?? true,
    transitionStatus: undefined,
    referenceElement: (options.referenceElement ?? null) as Element | null,
    floatingElement: options.floatingElement ?? null,
    triggerElements: createTriggerMap(),
    floatingId: undefined,
    syncOnly: false,
    nested: false,
    onOpenChange: undefined,
  });
}

function guards() {
  return document.querySelectorAll("[data-base-ui-focus-guard]");
}

describe("FloatingFocusManager", () => {
  it("renders before/after inside guards when modal and open", () => {
    const store = createStore();
    render(() => <FloatingFocusManager context={store}>content</FloatingFocusManager>);
    expect(guards()).toHaveLength(2);
  });

  it("renders no guards when non-modal outside a portal", () => {
    const store = createStore();
    render(() => (
      <FloatingFocusManager context={store} modal={false}>
        content
      </FloatingFocusManager>
    ));
    expect(guards()).toHaveLength(0);
  });

  it("renders no guards when disabled", () => {
    const store = createStore();
    render(() => (
      <FloatingFocusManager context={store} disabled>
        content
      </FloatingFocusManager>
    ));
    expect(guards()).toHaveLength(0);
  });

  it("moves initial focus to the first tabbable element on open", async () => {
    const reference = document.createElement("button");
    reference.textContent = "reference";
    document.body.append(reference);

    const floating = document.createElement("div");
    const inner = document.createElement("button");
    inner.textContent = "inner";
    floating.append(inner);
    document.body.append(floating);

    const store = createStore({ referenceElement: reference, floatingElement: floating });
    render(() => <FloatingFocusManager context={store}>content</FloatingFocusManager>);

    await vi.waitFor(() => expect(inner).toHaveFocus());
  });

  it("returns focus to the reference element on unmount", async () => {
    const reference = document.createElement("button");
    reference.textContent = "reference";
    document.body.append(reference);
    reference.focus();

    const floating = document.createElement("div");
    const inner = document.createElement("button");
    inner.textContent = "inner";
    floating.append(inner);
    document.body.append(floating);

    const store = createStore({ referenceElement: reference, floatingElement: floating });
    const { unmount } = render(() => <FloatingFocusManager context={store}>content</FloatingFocusManager>);

    await vi.waitFor(() => expect(inner).toHaveFocus());
    unmount();
    await vi.waitFor(() => expect(reference).toHaveFocus());
  });

  it("skips return focus when returnFocus is false", async () => {
    const reference = document.createElement("button");
    reference.textContent = "reference";
    document.body.append(reference);
    reference.focus();

    const floating = document.createElement("div");
    const inner = document.createElement("button");
    inner.textContent = "inner";
    floating.append(inner);
    document.body.append(floating);

    const store = createStore({ referenceElement: reference, floatingElement: floating });
    const { unmount } = render(() => (
      <FloatingFocusManager context={store} returnFocus={false}>
        content
      </FloatingFocusManager>
    ));

    await vi.waitFor(() => expect(inner).toHaveFocus());
    unmount();
    // Let the queued return-focus microtask run; focus must stay inside.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(inner).toHaveFocus();
  });
});
