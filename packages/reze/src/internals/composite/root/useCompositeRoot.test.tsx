import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { For, Show, signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { ARROW_LEFT, ARROW_RIGHT } from "../composite";
import { CompositeItem } from "../item/CompositeItem";
import { useCompositeItem } from "../item/useCompositeItem";
import type { CompositeScrollBehavior } from "../scroll/scrollBehavior";
import { CompositeRoot } from "./CompositeRoot";

afterEach(cleanup);

function buttons(el: ParentNode): HTMLElement[] {
  return [...el.querySelectorAll("button")] as HTMLElement[];
}

function tabIndexes(el: ParentNode): (string | null)[] {
  return buttons(el).map((element) => element.getAttribute("tabindex"));
}

function pressKey(key: string) {
  const element = document.activeElement;
  if (!(element instanceof HTMLElement)) {
    throw new Error("No active HTMLElement to press a key on");
  }

  fire(element, "keydown", { key } as KeyboardEventInit);
  fire(element, "keyup", { key } as KeyboardEventInit);
  tick();
}

const TWO_ITEMS = [0, 1];
const THREE_ITEMS = [0, 1, 2];

function renderComposite(props: { count?: number; activeIndex?: number; disabled?: number[] } = {}) {
  const { activeIndex, count = 4, disabled = [] } = props;

  const result = mount(() => (
    <CompositeRoot orientation="horizontal">
      <For each={Array.from({ length: count }, (_, index) => index)}>
        {(index) => (
          <CompositeItem
            as="button"
            disabled={disabled.includes(index) || undefined}
            data-composite-item-active={index === activeIndex ? "" : undefined}
          >
            item {index}
          </CompositeItem>
        )}
      </For>
    </CompositeRoot>
  ));
  tick();

  return result;
}

describe("useCompositeRoot roving tab stop", () => {
  it("exposes exactly one tab stop", () => {
    const { el } = renderComposite();

    expect(tabIndexes(el)).toEqual(["0", "-1", "-1", "-1"]);
  });

  it("moves the tab stop with arrow navigation", () => {
    const { el } = renderComposite();

    buttons(el)[0].focus();
    pressKey(ARROW_RIGHT);

    expect(tabIndexes(el)).toEqual(["-1", "0", "-1", "-1"]);
  });

  it("keeps exactly one tab stop after wrapping around the list", () => {
    const { el } = renderComposite();

    buttons(el)[0].focus();
    for (let i = 0; i < 5; i += 1) {
      pressKey(ARROW_RIGHT);
    }

    expect(tabIndexes(el).filter((value) => value === "0")).toHaveLength(1);
    expect(tabIndexes(el)).toEqual(["-1", "0", "-1", "-1"]);
  });

  it("moves the tab stop backwards", () => {
    const { el } = renderComposite();

    buttons(el)[0].focus();
    pressKey(ARROW_LEFT);

    expect(tabIndexes(el)).toEqual(["-1", "-1", "-1", "0"]);
  });

  it("gives the tab stop to the item marked as the active composite item", () => {
    const { el } = renderComposite({ activeIndex: 2 });

    expect(tabIndexes(el)).toEqual(["-1", "-1", "0", "-1"]);
  });

  it("moves the tab stop off a disabled first item", () => {
    const { el } = renderComposite({ disabled: [0] });

    expect(tabIndexes(el)).toEqual(["-1", "0", "-1", "-1"]);
  });

  it("does not give a tab stop to items added after mount", () => {
    let setCount!: (count: number) => void;

    function Test() {
      let count = signal(2);
      setCount = (next) => {
        count = next;
      };
      return (
        <CompositeRoot orientation="horizontal">
          <For each={Array.from({ length: count }, (_, index) => index)}>
            {(index) => <CompositeItem as="button">item {index}</CompositeItem>}
          </For>
        </CompositeRoot>
      );
    }

    const { el } = mount(() => <Test />);
    tick();

    setCount(4);
    tick();

    expect(tabIndexes(el)).toEqual(["0", "-1", "-1", "-1"]);
  });

  it("moves the tab stop back into range when the highlighted item unmounts", () => {
    let setCount!: (count: number) => void;

    function Test() {
      let count = signal(4);
      setCount = (next) => {
        count = next;
      };
      return (
        <CompositeRoot orientation="horizontal">
          <For each={Array.from({ length: count }, (_, index) => index)}>
            {(index) => <CompositeItem as="button">item {index}</CompositeItem>}
          </For>
        </CompositeRoot>
      );
    }

    const { el } = mount(() => <Test />);
    tick();

    buttons(el)[0].focus();
    pressKey(ARROW_RIGHT);
    expect(tabIndexes(el)).toEqual(["-1", "0", "-1", "-1"]);

    setCount(1);
    tick();

    expect(tabIndexes(el)).toEqual(["0"]);
  });

  it("keeps the tab stop on the highlighted item when an earlier item is removed", () => {
    // This scenario follows the highlighted item by element identity, so it uses
    // hook-based items over static buttons: a dynamic element re-creates its DOM node
    // when a sibling mounts or unmounts (see the `as` fast paths), which would read as
    // remove-plus-add instead of a removal. Downstream items (radio, tabs, toggle) all
    // consume the composite system through `useCompositeItem` like this.
    function HookItem(props: { children?: string }) {
      const composite = useCompositeItem();
      const merged = composite?.getCompositeProps();
      return (
        <button
          tabindex={merged?.tabIndex}
          onFocus={merged?.onFocus}
          onMouseMove={merged?.onMouseMove}
          ref={composite?.compositeRef}
        >
          {props.children}
        </button>
      );
    }

    let setShowFirst!: (show: boolean) => void;

    function Test() {
      let showFirst = signal(true);
      setShowFirst = (next) => {
        showFirst = next;
      };
      return (
        <CompositeRoot orientation="horizontal">
          <Show when={showFirst}>
            <HookItem>item 0</HookItem>
          </Show>
          <HookItem>item 1</HookItem>
          <HookItem>item 2</HookItem>
          <HookItem>item 3</HookItem>
        </CompositeRoot>
      );
    }

    const { el } = mount(() => <Test />);
    tick();

    buttons(el)[0].focus();
    pressKey(ARROW_RIGHT);
    pressKey(ARROW_RIGHT);
    expect(tabIndexes(el)).toEqual(["-1", "-1", "0", "-1"]);

    setShowFirst(false);
    tick();

    expect(tabIndexes(el)).toEqual(["-1", "0", "-1"]);
    expect(tabIndexes(el).filter((value) => value === "0")).toHaveLength(1);

    // Navigation continues from the item that holds the tab stop.
    pressKey(ARROW_RIGHT);

    expect(document.activeElement?.textContent).toBe("item 3");
    expect(tabIndexes(el)).toEqual(["-1", "-1", "0"]);
  });

  it("moves the tab stop to the active item when the highlighted item is removed", () => {
    let setItems!: (items: number[]) => void;

    function Test() {
      let items = signal([0, 1, 2, 3]);
      setItems = (next) => {
        items = next;
      };
      return (
        <CompositeRoot orientation="horizontal">
          <For each={items}>
            {(index) => (
              <CompositeItem as="button" data-composite-item-active={index === 2 ? "" : undefined}>
                item {index}
              </CompositeItem>
            )}
          </For>
        </CompositeRoot>
      );
    }

    const { el } = mount(() => <Test />);
    tick();
    expect(tabIndexes(el)).toEqual(["-1", "-1", "0", "-1"]);

    buttons(el)[2].focus();
    pressKey(ARROW_RIGHT);
    expect(tabIndexes(el)).toEqual(["-1", "-1", "-1", "0"]);

    setItems([0, 1, 2]);
    tick();

    expect(tabIndexes(el)).toEqual(["-1", "-1", "0"]);
  });
});

describe("useCompositeRoot tab stop cost", () => {
  it.each([10, 50, 200])("writes exactly two tabindex attributes per navigation with %i items", (count) => {
    const { el } = renderComposite({ count });

    const native = Element.prototype.setAttribute;
    let writes = 0;
    Element.prototype.setAttribute = function instrumented(this: Element, name: string, value: string) {
      if (name === "tabindex") {
        writes += 1;
      }
      return native.call(this, name, value);
    };

    try {
      buttons(el)[0].focus();
      pressKey(ARROW_RIGHT);
    } finally {
      Element.prototype.setAttribute = native;
    }

    expect(writes).toBe(2);
    expect(tabIndexes(el)[1]).toBe("0");
  });
});

describe("useCompositeRoot scroll behavior", () => {
  it("invokes the injected scroll behavior when navigating", () => {
    const scrollBehavior = vi.fn<CompositeScrollBehavior>();

    const { el } = mount(() => (
      <CompositeRoot orientation="horizontal" scrollBehavior={scrollBehavior}>
        <For each={THREE_ITEMS}>{(index) => <CompositeItem as="button">item {index}</CompositeItem>}</For>
      </CompositeRoot>
    ));
    tick();
    scrollBehavior.mockClear();

    buttons(el)[0].focus();
    pressKey(ARROW_RIGHT);

    expect(scrollBehavior).toHaveBeenCalledTimes(1);
    expect(scrollBehavior.mock.calls[0][0]).toMatchObject({
      element: buttons(el)[1],
      direction: "ltr",
      orientation: "horizontal",
    });
  });

  it("passes the composite root as the scroll container", () => {
    const scrollBehavior = vi.fn<CompositeScrollBehavior>();

    const { el } = mount(() => (
      <CompositeRoot orientation="horizontal" scrollBehavior={scrollBehavior}>
        <For each={TWO_ITEMS}>{(index) => <CompositeItem as="button">item {index}</CompositeItem>}</For>
      </CompositeRoot>
    ));
    tick();

    buttons(el)[0].focus();
    pressKey(ARROW_RIGHT);

    expect(scrollBehavior.mock.calls.at(-1)?.[0].container).toBe(el.firstElementChild);
  });

  it("scrolls only the composite container on mount, never the page", () => {
    // The mount scroll runs during render, so the prototype is spied before it.
    // happy-dom elements have no `scrollTo`; the spy also satisfies the helper's guard.
    const scrollTo = vi.fn();
    const proto = Element.prototype as unknown as Record<string, unknown>;
    const prev = proto.scrollTo;
    proto.scrollTo = scrollTo;

    let el!: Element;
    try {
      ({ el } = mount(() => (
        <CompositeRoot orientation="vertical">
          <For each={THREE_ITEMS}>
            {(index) => (
              <CompositeItem as="button" data-composite-item-active={index === 2 ? "" : undefined}>
                item {index}
              </CompositeItem>
            )}
          </For>
        </CompositeRoot>
      )) as unknown as { el: Element });
      tick();
    } finally {
      if (prev === undefined) {
        delete proto.scrollTo;
      } else {
        proto.scrollTo = prev;
      }
    }

    // The default behavior scrolls the composite root itself. A native
    // `scrollIntoView` default would never reach the container here (and would move
    // page-level ancestors instead).
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo.mock.instances[0]).toBe(el.firstElementChild);
  });
});

describe("useCompositeRoot tab stop ownership (experiment 6)", () => {
  it("exposes exactly one tab stop", () => {
    const { el } = renderComposite({ count: 5 });

    expect(tabIndexes(el)).toEqual(["0", "-1", "-1", "-1", "-1"]);
    expect(tabIndexes(el).filter((value) => value === "0")).toHaveLength(1);
  });

  it("puts the tab stop on the active item rather than the first-created one", () => {
    const { el } = renderComposite({ count: 4, activeIndex: 2 });

    expect(tabIndexes(el)).toEqual(["-1", "-1", "0", "-1"]);
  });

  it("keeps exactly one tab stop when items are created out of document order", () => {
    const { el } = mount(() => (
      <CompositeRoot orientation="horizontal">
        <div style={{ display: "contents" }}>
          <CompositeItem as="button">second</CompositeItem>
        </div>
        <CompositeItem as="button">first</CompositeItem>
      </CompositeRoot>
    ));
    tick();

    const tabStops = buttons(el).filter((element) => element.getAttribute("tabindex") === "0");

    expect(tabStops).toHaveLength(1);
    // Document order decides, not creation order.
    expect(tabStops[0].textContent).toBe("second");
  });

  it("moves the single tab stop when items are added before the current one", () => {
    let setCount!: (count: number) => void;

    function Test() {
      let count = signal(2);
      setCount = (next) => {
        count = next;
      };
      return (
        <CompositeRoot orientation="horizontal">
          <For each={Array.from({ length: count }, (_, index) => index)}>
            {(index) => <CompositeItem as="button">item {index}</CompositeItem>}
          </For>
        </CompositeRoot>
      );
    }

    const { el } = mount(() => <Test />);
    tick();

    expect(tabIndexes(el)).toEqual(["0", "-1"]);

    setCount(4);
    tick();

    expect(tabIndexes(el)).toEqual(["0", "-1", "-1", "-1"]);
    expect(tabIndexes(el).filter((value) => value === "0")).toHaveLength(1);
  });

  it("still has one tab stop after navigating", () => {
    const { el } = renderComposite({ count: 4 });

    buttons(el)[0].focus();
    pressKey(ARROW_RIGHT);

    expect(tabIndexes(el)).toEqual(["-1", "0", "-1", "-1"]);

    pressKey(ARROW_LEFT);

    expect(tabIndexes(el)).toEqual(["0", "-1", "-1", "-1"]);
    expect(tabIndexes(el).filter((value) => value === "0")).toHaveLength(1);
  });
});

describe("composite static elements", () => {
  function items(el: ParentNode): HTMLElement[] {
    return [...el.querySelectorAll("[data-testid='item']")] as HTMLElement[];
  }

  function itemTabIndexes(el: ParentNode): (string | null)[] {
    return items(el).map((element) => element.getAttribute("tabindex"));
  }

  it("navigates default div items and follows them by identity", () => {
    let setShowFirst!: (show: boolean) => void;

    function Test() {
      let showFirst = signal(true);
      setShowFirst = (next) => {
        showFirst = next;
      };
      return (
        <CompositeRoot orientation="horizontal">
          <Show when={showFirst}>
            <CompositeItem data-testid="item">item 0</CompositeItem>
          </Show>
          <CompositeItem data-testid="item">item 1</CompositeItem>
          <CompositeItem data-testid="item">item 2</CompositeItem>
        </CompositeRoot>
      );
    }

    const { el } = mount(() => <Test />);
    tick();

    expect(el.firstElementChild?.tagName).toBe("DIV");
    expect(itemTabIndexes(el)).toEqual(["0", "-1", "-1"]);

    items(el)[0].focus();
    pressKey(ARROW_RIGHT);
    expect(itemTabIndexes(el)).toEqual(["-1", "0", "-1"]);

    setShowFirst(false);
    tick();

    expect(itemTabIndexes(el)).toEqual(["0", "-1"]);
    expect(items(el)[0].textContent).toBe("item 1");
  });

  it("supports a customized root element", () => {
    const { el } = mount(() => (
      <CompositeRoot orientation="horizontal" as="section">
        <For each={THREE_ITEMS}>{(index) => <CompositeItem data-testid="item">item {index}</CompositeItem>}</For>
      </CompositeRoot>
    ));
    tick();

    expect(el.firstElementChild?.tagName).toBe("SECTION");
    expect(itemTabIndexes(el)).toEqual(["0", "-1", "-1"]);

    items(el)[0].focus();
    pressKey(ARROW_RIGHT);

    expect(itemTabIndexes(el)).toEqual(["-1", "0", "-1"]);
    expect(document.activeElement?.textContent).toBe("item 1");
  });
});
