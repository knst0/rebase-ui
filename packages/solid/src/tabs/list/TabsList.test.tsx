import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { describeConformance, pressKey } from "#test-utils";

import * as Tabs from "../index.parts";
import * as TabsTabDataAttributes from "../tab/TabsTabDataAttributes";
import * as TabsListDataAttributes from "./TabsListDataAttributes";

function renderTabs(props: { activateOnFocus?: boolean; loopFocus?: boolean; orientation?: "horizontal" | "vertical" } = {}) {
  return (
    <Tabs.Root defaultValue="one" orientation={props.orientation}>
      <Tabs.List activateOnFocus={props.activateOnFocus} loopFocus={props.loopFocus}>
        <Tabs.Tab value="one">One</Tabs.Tab>
        <Tabs.Tab value="two">Two</Tabs.Tab>
        <Tabs.Tab value="three">Three</Tabs.Tab>
      </Tabs.List>
    </Tabs.Root>
  );
}

describe("<Tabs.List />", () => {
  describeConformance(
    (props) => (
      <Tabs.Root defaultValue="one">
        <Tabs.List {...props} />
      </Tabs.Root>
    ),
    () => ({
      render,
      defaultElement: "div",
      stateAttributes: { [TabsListDataAttributes.orientation]: "horizontal", [TabsListDataAttributes.activationDirection]: "none" },
    }),
  );

  it("renders a `tablist`", () => {
    render(() => renderTabs());

    expect(screen.queryByRole("tablist")).not.toBe(null);
  });

  it("does not set `aria-orientation` when horizontal", () => {
    render(() => renderTabs());

    expect(screen.getByRole("tablist")).not.toHaveAttribute("aria-orientation");
  });

  it("sets `aria-orientation` when vertical", () => {
    render(() => renderTabs({ orientation: "vertical" }));

    expect(screen.getByRole("tablist")).toHaveAttribute("aria-orientation", "vertical");
  });

  it("moves focus with the arrow keys without activating", () => {
    render(() => renderTabs());

    const [tab1, tab2] = screen.getAllByRole("tab");

    tab1.focus();
    flush();

    pressKey("ArrowRight");
    flush();
    flush();

    expect(document.activeElement).toBe(tab2);
    expect(tab1).toHaveAttribute("aria-selected", "true");
    expect(tab2).toHaveAttribute("aria-selected", "false");
  });

  it("activates on focus when `activateOnFocus` is set", () => {
    render(() => renderTabs({ activateOnFocus: true }));

    const [tab1, tab2] = screen.getAllByRole("tab");

    tab1.focus();
    flush();

    pressKey("ArrowRight");
    flush();

    expect(document.activeElement).toBe(tab2);
    expect(tab2).toHaveAttribute("aria-selected", "true");
  });

  it("loops focus by default", () => {
    render(() => renderTabs());

    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    flush();

    pressKey("ArrowLeft");

    expect(document.activeElement).toBe(tabs[2]);
  });

  it("does not loop focus when `loopFocus` is false", () => {
    render(() => renderTabs({ loopFocus: false }));

    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    flush();

    pressKey("ArrowLeft");

    expect(document.activeElement).toBe(tabs[0]);
  });

  it("never activates a tab while navigating with the keyboard", () => {
    const onValueChange = vi.fn();

    render(() => (
      <Tabs.Root defaultValue="one" onValueChange={onValueChange}>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
          <Tabs.Tab value="three" disabled>
            Three
          </Tabs.Tab>
          <Tabs.Tab value="four">Four</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    flush();

    for (const key of ["ArrowRight", "ArrowRight", "ArrowRight", "End", "Home", "ArrowLeft"]) {
      pressKey(key);

      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      expect(tabs[0]).toHaveAttribute(TabsTabDataAttributes.active);
    }

    for (const tab of tabs.slice(1)) {
      expect(tab).toHaveAttribute("aria-selected", "false");
    }

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("supports Home and End", () => {
    render(() => renderTabs());

    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    flush();

    pressKey("End");
    expect(document.activeElement).toBe(tabs[2]);

    pressKey("Home");
    expect(document.activeElement).toBe(tabs[0]);
  });

  it("uses the vertical arrow keys when the orientation is vertical", () => {
    render(() => renderTabs({ orientation: "vertical" }));

    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    flush();

    pressKey("ArrowDown");

    expect(document.activeElement).toBe(tabs[1]);
  });

  describe("resize observation", () => {
    function spyOnResizeObserver() {
      const native = window.ResizeObserver;
      const instances: Array<{ callback: ResizeObserverCallback; observed: Set<Element> }> = [];

      class SpyResizeObserver {
        private readonly record: { callback: ResizeObserverCallback; observed: Set<Element> };

        constructor(callback: ResizeObserverCallback) {
          this.record = { callback, observed: new Set() };
          instances.push(this.record);
        }

        observe(element: Element) {
          this.record.observed.add(element);
        }

        unobserve(element: Element) {
          this.record.observed.delete(element);
        }

        disconnect() {
          this.record.observed.clear();
        }
      }

      window.ResizeObserver = SpyResizeObserver as unknown as typeof ResizeObserver;
      return { instances, restore: () => (window.ResizeObserver = native) };
    }

    it("does not create an observer for a list without an indicator", () => {
      const { instances, restore } = spyOnResizeObserver();

      try {
        render(() => renderTabs());
        flush();

        expect(instances).toHaveLength(0);
      } finally {
        restore();
      }
    });

    it("observes the list and every tab once an indicator is present", () => {
      const { instances, restore } = spyOnResizeObserver();

      try {
        render(() => (
          <Tabs.Root defaultValue="one">
            <Tabs.List data-testid="list">
              <Tabs.Indicator />
              <Tabs.Tab value="one">One</Tabs.Tab>
              <Tabs.Tab value="two">Two</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ));
        flush();

        expect(instances).toHaveLength(1);
        expect(instances[0].observed).toEqual(new Set([screen.getByTestId("list"), ...screen.getAllByRole("tab")]));
      } finally {
        restore();
      }
    });

    it("notifies indicator listeners once per frame regardless of entry count", async () => {
      const { instances, restore } = spyOnResizeObserver();

      try {
        render(() => (
          <Tabs.Root defaultValue="one">
            <Tabs.List>
              <Tabs.Indicator data-testid="indicator" />
              <Tabs.Tab value="one">One</Tabs.Tab>
              <Tabs.Tab value="two">Two</Tabs.Tab>
              <Tabs.Tab value="three">Three</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ));
        flush();

        const observer = instances[0];
        // A geometry recompute measures the active tab and the list exactly once each.
        const measure = vi.spyOn(window.HTMLElement.prototype, "getBoundingClientRect");

        try {
          for (let entry = 0; entry < 4; entry++) {
            observer.callback([] as unknown as ResizeObserverEntry[], null as unknown as ResizeObserver);
          }

          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          flush();

          expect(measure).toHaveBeenCalledTimes(2);
        } finally {
          measure.mockRestore();
        }
      } finally {
        restore();
      }
    });
  });
});
