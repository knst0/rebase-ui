import { cleanup, mount, tick } from "@rezejs/testing-library";
import { store } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createFloating } from "../createFloating";
import { createListNavigation, type CreateListNavigationProps } from "./createListNavigation";
import { createTypeahead } from "./createTypeahead";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

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

// Emulates the owning component: `open`/`activeIndex` are owner state,
// mirrored from `onOpenChange`/`onNavigate` like the hover test owner.
function createListHarness(options: Partial<CreateListNavigationProps> = {}): ListHarness {
  const ownerState = store({ open: false, activeIndex: null as number | null });
  let captured: ReturnType<typeof createFloating> | undefined;
  let nav: ReturnType<typeof createListNavigation> | undefined;
  const listRef = { current: [] as Array<HTMLElement | null> };
  function Test(): null {
    captured = createFloating({
      open: () => ownerState.open,
      onOpenChange: (nextOpen) => {
        ownerState.open = nextOpen;
      },
    });
    nav = createListNavigation(captured.context, {
      listRef,
      activeIndex: () => ownerState.activeIndex,
      onNavigate: (index) => {
        ownerState.activeIndex = index;
      },
      ...options,
    });
    return null;
  }
  const { dispose } = mount(Test);
  tick();

  const context = captured!.context;
  const reference = document.createElement("button");
  const floating = document.createElement("div");
  const items = [document.createElement("button"), document.createElement("button"), document.createElement("button")];
  document.body.append(reference, floating, ...items);

  listRef.current = items;
  context.refs.setReference(reference);
  context.refs.setFloating(floating);
  ownerState.open = true;

  const referenceProps = nav!.reference();
  const floatingProps = nav!.floating();
  const onReferenceKeyDown = (event: Event) => referenceProps.onKeyDown(event as KeyboardEvent);
  const onFloatingKeyDown = (event: Event) => floatingProps.onKeyDown(event as KeyboardEvent);
  reference.addEventListener("keydown", onReferenceKeyDown);
  floating.addEventListener("keydown", onFloatingKeyDown);
  tick();

  return {
    context,
    reference,
    floating,
    items,
    activeIndex: () => ownerState.activeIndex,
    cleanup: () => {
      reference.removeEventListener("keydown", onReferenceKeyDown);
      floating.removeEventListener("keydown", onFloatingKeyDown);
      reference.remove();
      floating.remove();
      items.forEach((item) => item.remove());
      dispose();
    },
  };
}

describe("list navigation and typeahead", () => {
  it("arrow keys move the active index and focus the item", () => {
    const harness = createListHarness();
    try {
      keydown(harness.reference, "ArrowDown");
      tick();
      expect(harness.activeIndex()).toBe(0);
      expect(document.activeElement).toBe(harness.items[0]);

      keydown(harness.reference, "ArrowDown");
      tick();
      expect(harness.activeIndex()).toBe(1);
      expect(document.activeElement).toBe(harness.items[1]);

      keydown(harness.reference, "ArrowUp");
      tick();
      expect(harness.activeIndex()).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  it("Home and End jump to the first and last items", () => {
    const harness = createListHarness();
    try {
      keydown(harness.floating, "End");
      tick();
      expect(harness.activeIndex()).toBe(2);

      keydown(harness.floating, "Home");
      tick();
      expect(harness.activeIndex()).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  it("clamps at the boundary without loopFocus", () => {
    const harness = createListHarness();
    try {
      keydown(harness.floating, "End");
      tick();
      expect(harness.activeIndex()).toBe(2);

      keydown(harness.reference, "ArrowDown");
      tick();
      expect(harness.activeIndex()).toBe(2);

      keydown(harness.floating, "Home");
      tick();
      keydown(harness.reference, "ArrowUp");
      tick();
      expect(harness.activeIndex()).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  it("loopFocus wraps past the boundary", () => {
    const harness = createListHarness({ loopFocus: true });
    try {
      keydown(harness.floating, "End");
      tick();
      expect(harness.activeIndex()).toBe(2);

      keydown(harness.reference, "ArrowDown");
      tick();
      expect(harness.activeIndex()).toBe(0);

      keydown(harness.reference, "ArrowUp");
      tick();
      expect(harness.activeIndex()).toBe(2);
    } finally {
      harness.cleanup();
    }
  });

  it("skips disabled indices while navigating", () => {
    const harness = createListHarness({ disabledIndices: [1] });
    try {
      keydown(harness.reference, "ArrowDown");
      tick();
      expect(harness.activeIndex()).toBe(0);

      keydown(harness.reference, "ArrowDown");
      tick();
      expect(harness.activeIndex()).toBe(2);

      keydown(harness.reference, "ArrowUp");
      tick();
      expect(harness.activeIndex()).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  it("typeahead matches the typed prefix", () => {
    const ownerState = store({ open: false, activeIndex: null as number | null });
    let captured: ReturnType<typeof createFloating> | undefined;
    let typeahead: ReturnType<typeof createTypeahead> | undefined;
    const matched: Array<number> = [];
    function Test(): null {
      captured = createFloating({
        open: () => ownerState.open,
        onOpenChange: (nextOpen) => {
          ownerState.open = nextOpen;
        },
      });
      typeahead = createTypeahead(captured.context, {
        listRef: { current: ["apple", "apricot", "banana"] },
        activeIndex: () => ownerState.activeIndex,
        onMatch: (index) => {
          matched.push(index);
          ownerState.activeIndex = index;
        },
      });
      return null;
    }
    const { dispose } = mount(Test);
    tick();
    try {
      const context = captured!.context;
      const reference = document.createElement("input");
      document.body.appendChild(reference);
      context.refs.setReference(reference);
      ownerState.open = true;

      const typeaheadProps = typeahead!.reference();
      const onKeyDown = (event: Event) => typeaheadProps.onKeyDown(event as KeyboardEvent);
      reference.addEventListener("keydown", onKeyDown);
      tick();

      try {
        keydown(reference, "b");
        tick();
        expect(matched).toEqual([2]);
        expect(ownerState.activeIndex).toBe(2);
      } finally {
        reference.removeEventListener("keydown", onKeyDown);
        reference.remove();
      }
    } finally {
      dispose();
    }
  });
});
