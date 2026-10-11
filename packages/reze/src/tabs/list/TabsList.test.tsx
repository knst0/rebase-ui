import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as Tabs from "../index.parts";
import * as TabsTabDataAttributes from "../tab/TabsTabDataAttributes";
import * as TabsListDataAttributes from "./TabsListDataAttributes";

afterEach(cleanup);

function pressKey(key: string) {
  const element = document.activeElement;
  if (!(element instanceof HTMLElement)) {
    throw new Error("No active HTMLElement to press a key on");
  }

  fire(element, "keydown", { key } as KeyboardEventInit);
  fire(element, "keyup", { key } as KeyboardEventInit);
  tick();
}

function renderTabs(props: { activateOnFocus?: boolean; loopFocus?: boolean; orientation?: "horizontal" | "vertical" } = {}) {
  mount(() => (
    <Tabs.Root defaultValue="one" orientation={props.orientation}>
      <Tabs.List activateOnFocus={props.activateOnFocus} loopFocus={props.loopFocus}>
        <Tabs.Tab value="one">One</Tabs.Tab>
        <Tabs.Tab value="two">Two</Tabs.Tab>
        <Tabs.Tab value="three">Three</Tabs.Tab>
      </Tabs.List>
    </Tabs.Root>
  ));
  tick();
}

describe("<Tabs.List />", () => {
  it("renders a div element by default", () => {
    renderTabs();

    expect(screen.getByRole("tablist").tagName).toBe("DIV");
  });

  it("renders the customized list element", () => {
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List as="section">
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(screen.getByRole("tablist").tagName).toBe("SECTION");
  });

  it("attaches a callback ref to the list element", () => {
    let instance: HTMLElement | null = null;
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        >
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(instance).toBe(screen.getByRole("tablist"));
  });

  it("sets the state attributes", () => {
    renderTabs();

    const list = screen.getByRole("tablist");
    expect(list).toHaveAttribute(TabsListDataAttributes.orientation, "horizontal");
    expect(list).toHaveAttribute(TabsListDataAttributes.activationDirection, "none");
  });

  it("renders a `tablist`", () => {
    renderTabs();

    expect(screen.queryByRole("tablist")).not.toBe(null);
  });

  it("does not set `aria-orientation` when horizontal", () => {
    renderTabs();

    expect(screen.getByRole("tablist")).not.toHaveAttribute("aria-orientation");
  });

  it("sets `aria-orientation` when vertical", () => {
    renderTabs({ orientation: "vertical" });

    expect(screen.getByRole("tablist")).toHaveAttribute("aria-orientation", "vertical");
  });

  it("moves focus with the arrow keys without activating", () => {
    renderTabs();

    const [tab1, tab2] = screen.getAllByRole("tab");

    tab1.focus();
    tick();

    pressKey("ArrowRight");
    tick();

    expect(document.activeElement).toBe(tab2);
    expect(tab1).toHaveAttribute("aria-selected", "true");
    expect(tab2).toHaveAttribute("aria-selected", "false");
  });

  it("activates on focus when `activateOnFocus` is set", () => {
    renderTabs({ activateOnFocus: true });

    const [tab1, tab2] = screen.getAllByRole("tab");

    tab1.focus();
    tick();

    pressKey("ArrowRight");

    expect(document.activeElement).toBe(tab2);
    expect(tab2).toHaveAttribute("aria-selected", "true");
  });

  it("loops focus by default", () => {
    renderTabs();

    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    tick();

    pressKey("ArrowLeft");

    expect(document.activeElement).toBe(tabs[2]);
  });

  it("does not loop focus when `loopFocus` is false", () => {
    renderTabs({ loopFocus: false });

    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    tick();

    pressKey("ArrowLeft");

    expect(document.activeElement).toBe(tabs[0]);
  });

  it("never activates a tab while navigating with the keyboard", () => {
    const onValueChange = vi.fn();

    mount(() => (
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
    tick();

    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    tick();

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

  it("advances focus on consecutive arrow presses", () => {
    renderTabs();

    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    tick();

    pressKey("ArrowRight");
    expect(document.activeElement).toBe(tabs[1]);

    pressKey("ArrowRight");
    expect(document.activeElement).toBe(tabs[2]);
  });

  it("follows orientation changes after mount", () => {
    function Test() {
      let orientation: "horizontal" | "vertical" = signal("horizontal");
      return (
        <>
          <Tabs.Root defaultValue="one" orientation={orientation}>
            <Tabs.List>
              <Tabs.Tab value="one">One</Tabs.Tab>
              <Tabs.Tab value="two">Two</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
          <button onClick={() => (orientation = "vertical")}>Flip</button>
        </>
      );
    }
    mount(() => <Test />);
    tick();

    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    tick();

    pressKey("ArrowDown");
    expect(document.activeElement).toBe(tabs[0]);

    fire(screen.getByRole("button", { name: "Flip" }), "click");
    tick();

    pressKey("ArrowDown");
    expect(document.activeElement).toBe(tabs[1]);
  });

  it("supports Home and End", () => {
    renderTabs();

    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    tick();

    pressKey("End");
    expect(document.activeElement).toBe(tabs[2]);

    pressKey("Home");
    expect(document.activeElement).toBe(tabs[0]);
  });

  it("uses the vertical arrow keys when the orientation is vertical", () => {
    renderTabs({ orientation: "vertical" });

    const tabs = screen.getAllByRole("tab");

    tabs[0].focus();
    tick();

    pressKey("ArrowDown");

    expect(document.activeElement).toBe(tabs[1]);
  });

  describe("render props", () => {
    it("calls the class function with the component state", () => {
      let stateArgument: unknown;
      mount(() => (
        <Tabs.Root defaultValue="one">
          <Tabs.List
            class={(state) => {
              stateArgument = state;
              return "";
            }}
          >
            <Tabs.Tab value="one">One</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      tick();

      expect(screen.getByRole("tablist")).toBeTruthy();
      expect(stateArgument).toEqual({ orientation: "horizontal", tabActivationDirection: "none" });
    });

    it("renders children defined as a function of state", () => {
      mount(() => (
        <Tabs.Root defaultValue="one" orientation="vertical">
          <Tabs.List>{(state) => (state.orientation === "vertical" ? "V" : "H")}</Tabs.List>
        </Tabs.Root>
      ));
      tick();

      expect(screen.getByRole("tablist").textContent).toBe("V");
    });
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
        renderTabs();

        expect(instances).toHaveLength(0);
      } finally {
        restore();
      }
    });

    it("observes the list and every tab once an indicator is present", () => {
      const { instances, restore } = spyOnResizeObserver();

      try {
        mount(() => (
          <Tabs.Root defaultValue="one">
            <Tabs.List data-testid="list">
              <Tabs.Indicator />
              <Tabs.Tab value="one">One</Tabs.Tab>
              <Tabs.Tab value="two">Two</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ));
        tick();

        expect(instances).toHaveLength(1);
        expect(instances[0].observed).toEqual(new Set([screen.getByTestId("list"), ...screen.getAllByRole("tab")]));
      } finally {
        restore();
      }
    });

    it("notifies indicator listeners once per frame regardless of entry count", async () => {
      const { instances, restore } = spyOnResizeObserver();

      try {
        mount(() => (
          <Tabs.Root defaultValue="one">
            <Tabs.List>
              <Tabs.Indicator data-testid="indicator" />
              <Tabs.Tab value="one">One</Tabs.Tab>
              <Tabs.Tab value="two">Two</Tabs.Tab>
              <Tabs.Tab value="three">Three</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ));
        tick();

        const observer = instances[0];
        // A geometry recompute measures the active tab and the list exactly once each.
        const measure = vi.spyOn(window.HTMLElement.prototype, "getBoundingClientRect");

        try {
          for (let entry = 0; entry < 4; entry++) {
            observer.callback([], null as unknown as ResizeObserver);
          }

          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          tick();

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
