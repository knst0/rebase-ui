import { render, screen } from "@solidjs/testing-library";
import { createSignal, flush, For, Show } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { pressKey } from "#test-utils";

import { ARROW_LEFT, ARROW_RIGHT } from "../composite";
import { ACTIVE_COMPOSITE_ITEM } from "../constants";
import { CompositeItem } from "../item/CompositeItem";
import type { CompositeScrollBehavior } from "../scroll/scrollBehavior";
import { CompositeRoot } from "./CompositeRoot";

function tabIndexes() {
  return screen.getAllByRole("button").map((element) => element.getAttribute("tabindex"));
}

function renderComposite(props: { count?: number; activeIndex?: number; disabled?: number[] } = {}) {
  const { activeIndex, count = 4, disabled = [] } = props;

  return render(() => (
    <CompositeRoot orientation="horizontal">
      <For each={Array.from({ length: count }, (_, index) => index)}>
        {(index) => (
          <CompositeItem
            as="button"
            props={
              {
                children: `item ${index}`,
                disabled: disabled.includes(index) || undefined,
                [ACTIVE_COMPOSITE_ITEM]: index === activeIndex ? "" : undefined,
              } as Record<string, unknown>
            }
          />
        )}
      </For>
    </CompositeRoot>
  ));
}

describe("useCompositeRoot roving tab stop", () => {
  it("exposes exactly one tab stop", () => {
    renderComposite();

    expect(tabIndexes()).toEqual(["0", "-1", "-1", "-1"]);
  });

  it("moves the tab stop with arrow navigation", () => {
    renderComposite();

    screen.getAllByRole("button")[0].focus();
    pressKey(ARROW_RIGHT);
    flush();

    expect(tabIndexes()).toEqual(["-1", "0", "-1", "-1"]);
  });

  it("keeps exactly one tab stop after wrapping around the list", () => {
    renderComposite();

    screen.getAllByRole("button")[0].focus();
    for (let i = 0; i < 5; i += 1) {
      pressKey(ARROW_RIGHT);
      flush();
    }

    expect(tabIndexes().filter((value) => value === "0")).toHaveLength(1);
    expect(tabIndexes()).toEqual(["-1", "0", "-1", "-1"]);
  });

  it("moves the tab stop backwards", () => {
    renderComposite();

    screen.getAllByRole("button")[0].focus();
    pressKey(ARROW_LEFT);
    flush();

    expect(tabIndexes()).toEqual(["-1", "-1", "-1", "0"]);
  });

  it("gives the tab stop to the item marked as the active composite item", () => {
    renderComposite({ activeIndex: 2 });
    flush();

    expect(tabIndexes()).toEqual(["-1", "-1", "0", "-1"]);
  });

  it("moves the tab stop off a disabled first item", () => {
    renderComposite({ disabled: [0] });
    flush();

    expect(tabIndexes()).toEqual(["-1", "0", "-1", "-1"]);
  });

  it("does not give a tab stop to items added after mount", () => {
    const [count, setCount] = createSignal(2);

    render(() => (
      <CompositeRoot orientation="horizontal">
        <For each={Array.from({ length: count() }, (_, index) => index)}>
          {(index) => <CompositeItem as="button" props={{ children: `item ${index}` }} />}
        </For>
      </CompositeRoot>
    ));
    flush();

    setCount(4);
    flush();

    expect(tabIndexes()).toEqual(["0", "-1", "-1", "-1"]);
  });

  it("moves the tab stop back into range when the highlighted item unmounts", () => {
    const [count, setCount] = createSignal(4);

    render(() => (
      <CompositeRoot orientation="horizontal">
        <For each={Array.from({ length: count() }, (_, index) => index)}>
          {(index) => <CompositeItem as="button" props={{ children: `item ${index}` }} />}
        </For>
      </CompositeRoot>
    ));

    screen.getAllByRole("button")[0].focus();
    pressKey(ARROW_RIGHT);
    flush();
    expect(tabIndexes()).toEqual(["-1", "0", "-1", "-1"]);

    setCount(1);
    flush();

    expect(tabIndexes()).toEqual(["0"]);
  });

  it("keeps the tab stop on the highlighted item when an earlier item is removed", () => {
    const [showFirst, setShowFirst] = createSignal(true);

    render(() => (
      <CompositeRoot orientation="horizontal">
        <Show when={showFirst()}>{<CompositeItem as="button" props={{ children: "item 0" }} />}</Show>
        <CompositeItem as="button" props={{ children: "item 1" }} />
        <CompositeItem as="button" props={{ children: "item 2" }} />
        <CompositeItem as="button" props={{ children: "item 3" }} />
      </CompositeRoot>
    ));

    screen.getAllByRole("button")[0].focus();
    pressKey(ARROW_RIGHT);
    flush();
    pressKey(ARROW_RIGHT);
    flush();
    expect(tabIndexes()).toEqual(["-1", "-1", "0", "-1"]);

    setShowFirst(false);
    flush();

    expect(tabIndexes()).toEqual(["-1", "0", "-1"]);
    expect(tabIndexes().filter((value) => value === "0")).toHaveLength(1);

    // Navigation continues from the item that holds the tab stop.
    pressKey(ARROW_RIGHT);
    flush();

    expect(document.activeElement?.textContent).toBe("item 3");
    expect(tabIndexes()).toEqual(["-1", "-1", "0"]);
  });

  it("moves the tab stop to the active item when the highlighted item is removed", () => {
    const [items, setItems] = createSignal([0, 1, 2, 3]);

    render(() => (
      <CompositeRoot orientation="horizontal">
        <For each={items()}>
          {(index) => (
            <CompositeItem
              as="button"
              props={
                {
                  children: `item ${index}`,
                  [ACTIVE_COMPOSITE_ITEM]: index === 2 ? "" : undefined,
                } as Record<string, unknown>
              }
            />
          )}
        </For>
      </CompositeRoot>
    ));
    flush();
    expect(tabIndexes()).toEqual(["-1", "-1", "0", "-1"]);

    screen.getAllByRole("button")[2].focus();
    pressKey(ARROW_RIGHT);
    flush();
    expect(tabIndexes()).toEqual(["-1", "-1", "-1", "0"]);

    setItems([0, 1, 2]);
    flush();

    expect(tabIndexes()).toEqual(["-1", "-1", "0"]);
  });
});

describe("useCompositeRoot tab stop cost", () => {
  it.each([10, 50, 200])("writes exactly two tabindex attributes per navigation with %i items", (count) => {
    renderComposite({ count });
    flush();

    const native = Element.prototype.setAttribute;
    let writes = 0;
    Element.prototype.setAttribute = function instrumented(this: Element, name: string, value: string) {
      if (name === "tabindex") {
        writes += 1;
      }
      return native.call(this, name, value);
    };

    try {
      screen.getAllByRole("button")[0].focus();
      pressKey(ARROW_RIGHT);
      flush();
    } finally {
      Element.prototype.setAttribute = native;
    }

    expect(writes).toBe(2);
    expect(tabIndexes()[1]).toBe("0");
  });
});

describe("useCompositeRoot scroll behavior", () => {
  it("invokes the injected scroll behavior when navigating", () => {
    const scrollBehavior = vi.fn<CompositeScrollBehavior>();

    render(() => (
      <CompositeRoot orientation="horizontal" scrollBehavior={scrollBehavior}>
        <For each={[0, 1, 2]}>{(index) => <CompositeItem as="button" props={{ children: `item ${index}` }} />}</For>
      </CompositeRoot>
    ));
    flush();
    scrollBehavior.mockClear();

    screen.getAllByRole("button")[0].focus();
    pressKey(ARROW_RIGHT);
    flush();

    expect(scrollBehavior).toHaveBeenCalledTimes(1);
    expect(scrollBehavior.mock.calls[0][0]).toMatchObject({
      element: screen.getAllByRole("button")[1],
      direction: "ltr",
      orientation: "horizontal",
    });
  });

  it("passes the composite root as the scroll container", () => {
    const scrollBehavior = vi.fn<CompositeScrollBehavior>();

    const { container } = render(() => (
      <CompositeRoot orientation="horizontal" scrollBehavior={scrollBehavior}>
        <For each={[0, 1]}>{(index) => <CompositeItem as="button" props={{ children: `item ${index}` }} />}</For>
      </CompositeRoot>
    ));
    flush();

    screen.getAllByRole("button")[0].focus();
    pressKey(ARROW_RIGHT);
    flush();

    expect(scrollBehavior.mock.calls.at(-1)?.[0].container).toBe(container.firstElementChild);
  });

  it("scrolls only the composite container on mount, never the page", () => {
    // The mount scroll runs during render, so the prototype is spied before it.
    // jsdom elements have no `scrollTo`; the spy also satisfies the helper's guard.
    const scrollTo = vi.fn();
    const proto = Element.prototype as unknown as Record<string, unknown>;
    const prev = proto.scrollTo;
    proto.scrollTo = scrollTo;

    let container: HTMLElement;
    try {
      ({ container } = render(() => (
        <CompositeRoot orientation="vertical">
          <For each={[0, 1, 2]}>
            {(index) => (
              <CompositeItem
                as="button"
                props={
                  {
                    children: `item ${index}`,
                    [ACTIVE_COMPOSITE_ITEM]: index === 2 ? "" : undefined,
                  } as Record<string, unknown>
                }
              />
            )}
          </For>
        </CompositeRoot>
      )) as unknown as { container: HTMLElement });
      flush();
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
    expect(scrollTo.mock.instances[0]).toBe(container.firstElementChild);
  });
});

describe("useCompositeRoot tab stop ownership (experiment 6)", () => {
  it("exposes exactly one tab stop", () => {
    renderComposite({ count: 5 });
    flush();

    expect(tabIndexes()).toEqual(["0", "-1", "-1", "-1", "-1"]);
    expect(tabIndexes().filter((value) => value === "0")).toHaveLength(1);
  });

  it("puts the tab stop on the active item rather than the first-created one", () => {
    renderComposite({ count: 4, activeIndex: 2 });
    flush();

    expect(tabIndexes()).toEqual(["-1", "-1", "0", "-1"]);
  });

  it("keeps exactly one tab stop when items are created out of document order", () => {
    render(() => (
      <CompositeRoot orientation="horizontal">
        <div style={{ display: "contents" }}>
          <CompositeItem as="button" props={{ children: "second" }} />
        </div>
        <CompositeItem as="button" props={{ children: "first" }} />
      </CompositeRoot>
    ));
    flush();

    const tabStops = screen.getAllByRole("button").filter((element) => element.getAttribute("tabindex") === "0");

    expect(tabStops).toHaveLength(1);
    // Document order decides, not creation order.
    expect(tabStops[0].textContent).toBe("second");
  });

  it("moves the single tab stop when items are added before the current one", () => {
    const [count, setCount] = createSignal(2, { ownedWrite: true });

    render(() => (
      <CompositeRoot orientation="horizontal">
        <For each={Array.from({ length: count() }, (_, index) => index)}>
          {(index) => <CompositeItem as="button" props={{ children: `item ${index}` }} />}
        </For>
      </CompositeRoot>
    ));
    flush();

    expect(tabIndexes()).toEqual(["0", "-1"]);

    setCount(4);
    flush();

    expect(tabIndexes()).toEqual(["0", "-1", "-1", "-1"]);
    expect(tabIndexes().filter((value) => value === "0")).toHaveLength(1);
  });

  it("still has one tab stop after navigating", () => {
    renderComposite({ count: 4 });
    flush();

    screen.getAllByRole("button")[0].focus();
    pressKey(ARROW_RIGHT);
    flush();

    expect(tabIndexes()).toEqual(["-1", "0", "-1", "-1"]);

    pressKey(ARROW_LEFT);
    flush();

    expect(tabIndexes()).toEqual(["0", "-1", "-1", "-1"]);
    expect(tabIndexes().filter((value) => value === "0")).toHaveLength(1);
  });
});
