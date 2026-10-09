import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { createFloating } from "../createFloating";
import { createListNavigation, type CreateListNavigationProps } from "./createListNavigation";
import { createTypeahead } from "./createTypeahead";

function keydown(target: Element, key: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

interface ListHarness {
  context: ReturnType<typeof createFloating>["context"];
  reference: HTMLButtonElement;
  floating: HTMLDivElement;
  items: HTMLButtonElement[];
  activeIndex: () => number | null;
  cleanup: () => void;
}

// Emulates the owning component: `open`/`activeIndex` are owner signals,
// mirrored from `onOpenChange`/`onNavigate` like the hover test owner.
function createListHarness(options: Partial<CreateListNavigationProps> = {}): ListHarness {
  const [open, setOpen] = createSignal(false, { ownedWrite: true });
  const [activeIndex, setActiveIndex] = createSignal<number | null>(null, { ownedWrite: true });
  const { context } = createFloating({
    open,
    onOpenChange: (nextOpen) => {
      setOpen(nextOpen);
    },
  });

  const listRef = { current: [] as Array<HTMLElement | null> };
  const nav = createListNavigation(context, {
    listRef,
    activeIndex,
    onNavigate: (index) => {
      setActiveIndex(index);
    },
    ...options,
  });

  const reference = document.createElement("button");
  const floating = document.createElement("div");
  const items = [document.createElement("button"), document.createElement("button"), document.createElement("button")];
  document.body.append(reference, floating, ...items);

  listRef.current = items;
  context.refs.setReference(reference);
  context.refs.setFloating(floating);
  setOpen(true);

  const referenceProps = nav.reference();
  const floatingProps = nav.floating();
  const onReferenceKeyDown = (event: Event) => referenceProps.onKeyDown(event as KeyboardEvent);
  const onFloatingKeyDown = (event: Event) => floatingProps.onKeyDown(event as KeyboardEvent);
  reference.addEventListener("keydown", onReferenceKeyDown);
  floating.addEventListener("keydown", onFloatingKeyDown);
  flush();

  return {
    context,
    reference,
    floating,
    items,
    activeIndex,
    cleanup: () => {
      reference.removeEventListener("keydown", onReferenceKeyDown);
      floating.removeEventListener("keydown", onFloatingKeyDown);
      reference.remove();
      floating.remove();
      items.forEach((item) => item.remove());
    },
  };
}

describe("list navigation and typeahead", () => {
  it("arrow keys move the active index and focus the item", () =>
    createRoot((dispose) => {
      const harness = createListHarness();
      try {
        keydown(harness.reference, "ArrowDown");
        flush();
        expect(harness.activeIndex()).toBe(0);
        expect(document.activeElement).toBe(harness.items[0]);

        keydown(harness.reference, "ArrowDown");
        flush();
        expect(harness.activeIndex()).toBe(1);
        expect(document.activeElement).toBe(harness.items[1]);

        keydown(harness.reference, "ArrowUp");
        flush();
        expect(harness.activeIndex()).toBe(0);
      } finally {
        harness.cleanup();
        dispose();
      }
    }));

  it("Home and End jump to the first and last items", () =>
    createRoot((dispose) => {
      const harness = createListHarness();
      try {
        keydown(harness.floating, "End");
        flush();
        expect(harness.activeIndex()).toBe(2);

        keydown(harness.floating, "Home");
        flush();
        expect(harness.activeIndex()).toBe(0);
      } finally {
        harness.cleanup();
        dispose();
      }
    }));

  it("clamps at the boundary without loopFocus", () =>
    createRoot((dispose) => {
      const harness = createListHarness();
      try {
        keydown(harness.floating, "End");
        flush();
        expect(harness.activeIndex()).toBe(2);

        keydown(harness.reference, "ArrowDown");
        flush();
        expect(harness.activeIndex()).toBe(2);

        keydown(harness.floating, "Home");
        flush();
        keydown(harness.reference, "ArrowUp");
        flush();
        expect(harness.activeIndex()).toBe(0);
      } finally {
        harness.cleanup();
        dispose();
      }
    }));

  it("loopFocus wraps past the boundary", () =>
    createRoot((dispose) => {
      const harness = createListHarness({ loopFocus: true });
      try {
        keydown(harness.floating, "End");
        flush();
        expect(harness.activeIndex()).toBe(2);

        keydown(harness.reference, "ArrowDown");
        flush();
        expect(harness.activeIndex()).toBe(0);

        keydown(harness.reference, "ArrowUp");
        flush();
        expect(harness.activeIndex()).toBe(2);
      } finally {
        harness.cleanup();
        dispose();
      }
    }));

  it("skips disabled indices while navigating", () =>
    createRoot((dispose) => {
      const harness = createListHarness({ disabledIndices: [1] });
      try {
        keydown(harness.reference, "ArrowDown");
        flush();
        expect(harness.activeIndex()).toBe(0);

        keydown(harness.reference, "ArrowDown");
        flush();
        expect(harness.activeIndex()).toBe(2);

        keydown(harness.reference, "ArrowUp");
        flush();
        expect(harness.activeIndex()).toBe(0);
      } finally {
        harness.cleanup();
        dispose();
      }
    }));

  it("typeahead matches the typed prefix", () =>
    createRoot((dispose) => {
      const [open, setOpen] = createSignal(false, { ownedWrite: true });
      const [activeIndex, setActiveIndex] = createSignal<number | null>(null, { ownedWrite: true });
      const { context } = createFloating({
        open,
        onOpenChange: (nextOpen) => {
          setOpen(nextOpen);
        },
      });

      const matched: Array<number> = [];
      const typeahead = createTypeahead(context, {
        listRef: { current: ["apple", "apricot", "banana"] },
        activeIndex,
        onMatch: (index) => {
          matched.push(index);
          setActiveIndex(index);
        },
      });

      const reference = document.createElement("input");
      document.body.appendChild(reference);
      context.refs.setReference(reference);
      setOpen(true);

      const typeaheadProps = typeahead.reference();
      const onKeyDown = (event: Event) => typeaheadProps.onKeyDown(event as KeyboardEvent);
      reference.addEventListener("keydown", onKeyDown);
      flush();

      try {
        keydown(reference, "b");
        flush();
        expect(matched).toEqual([2]);
        expect(activeIndex()).toBe(2);
      } finally {
        reference.removeEventListener("keydown", onKeyDown);
        reference.remove();
        dispose();
      }
    }));
});
