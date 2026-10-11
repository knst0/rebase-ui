import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as Tabs from "../index.parts";
import * as TabsIndicatorCssVars from "./TabsIndicatorCssVars";
import * as TabsIndicatorDataAttributes from "./TabsIndicatorDataAttributes";

afterEach(cleanup);

describe("<Tabs.Indicator />", () => {
  it("renders a span element by default", () => {
    const { el } = mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Indicator data-testid="indicator" />
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(el.querySelector('[data-testid="indicator"]')?.tagName).toBe("SPAN");
  });

  it("renders the customized indicator element", () => {
    const { el } = mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Indicator as="section" data-testid="indicator" />
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(el.querySelector('[data-testid="indicator"]')?.tagName).toBe("SECTION");
  });

  it("attaches a callback ref to the indicator element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Indicator
            data-testid="indicator"
            ref={(value: HTMLElement) => {
              instance = value;
            }}
          />
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(instance).toBe(el.querySelector('[data-testid="indicator"]'));
  });

  it("renders with a presentation role", () => {
    const { el } = mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Indicator data-testid="indicator" />
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(el.querySelector('[data-testid="indicator"]')).toHaveAttribute("role", "presentation");
  });

  it("renders nothing when no tab is selected", () => {
    const { el } = mount(() => (
      <Tabs.Root value={null}>
        <Tabs.List>
          <Tabs.Indicator data-testid="indicator" />
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(el.querySelector('[data-testid="indicator"]')).toBe(null);
  });

  it("sets the active tab css variables", () => {
    const { el } = mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Indicator data-testid="indicator" />
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    const indicator = el.querySelector('[data-testid="indicator"]') as HTMLElement;

    expect(indicator.style.getPropertyValue(TabsIndicatorCssVars.activeTabLeft)).not.toBe("");
    expect(indicator.style.getPropertyValue(TabsIndicatorCssVars.activeTabWidth)).not.toBe("");
  });

  it("carries the orientation attribute", () => {
    const { el } = mount(() => (
      <Tabs.Root defaultValue="two" orientation="vertical">
        <Tabs.List>
          <Tabs.Indicator data-testid="indicator" />
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    const indicator = el.querySelector('[data-testid="indicator"]') as HTMLElement;

    expect(indicator).toHaveAttribute(TabsIndicatorDataAttributes.orientation, "vertical");
    expect(indicator).toHaveAttribute(TabsIndicatorDataAttributes.activationDirection, "none");
  });

  it("tracks the activation direction", async () => {
    const user = userEvent.setup();
    const { el } = mount(() => (
      <Tabs.Root defaultValue="two">
        <Tabs.List>
          <Tabs.Indicator data-testid="indicator" />
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    await user.click(screen.getAllByRole("tab")[0]);
    tick();

    expect(el.querySelector('[data-testid="indicator"]')).toHaveAttribute(TabsIndicatorDataAttributes.activationDirection, "left");
  });

  it("calls the class function with the component state", () => {
    let stateArgument: unknown;
    const { el } = mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Indicator
            data-testid="indicator"
            class={(state) => {
              stateArgument = state;
              return "";
            }}
          />
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(el.querySelector('[data-testid="indicator"]')).toBeTruthy();
    expect(stateArgument).toMatchObject({ orientation: "horizontal", tabActivationDirection: "none" });
    expect((stateArgument as { activeTabPosition: unknown }).activeTabPosition).not.toBe(null);
    expect((stateArgument as { activeTabSize: unknown }).activeTabSize).not.toBe(null);
  });

  describe("transform-aware positioning", () => {
    function mockTabLayout(tab: HTMLElement, list: HTMLElement) {
      Object.defineProperties(tab, {
        offsetLeft: { value: 100, configurable: true },
        offsetTop: { value: 4, configurable: true },
        offsetWidth: { value: 80, configurable: true },
        offsetHeight: { value: 32, configurable: true },
        offsetParent: { value: list, configurable: true },
      });
      Object.defineProperties(list, {
        offsetLeft: { value: 0, configurable: true },
        offsetTop: { value: 0, configurable: true },
        offsetWidth: { value: 400, configurable: true },
        offsetHeight: { value: 32, configurable: true },
        offsetParent: { value: null, configurable: true },
        scrollWidth: { value: 400, configurable: true },
        scrollHeight: { value: 32, configurable: true },
        clientLeft: { value: 0, configurable: true },
        clientTop: { value: 0, configurable: true },
        scrollLeft: { value: 0, configurable: true },
        scrollTop: { value: 0, configurable: true },
      });
    }

    function mockRect(element: HTMLElement, rect: { left: number; top: number; width: number; height: number }) {
      vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
        x: rect.left,
        y: rect.top,
        ...rect,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        toJSON: () => {},
      });
    }

    function mockTabTransform(tab: HTMLElement, transform: string) {
      vi.spyOn(window, "getComputedStyle").mockImplementation(((element: Element) => {
        if (element === tab) {
          return { width: "", height: "", transform, translate: "none" };
        }
        return { width: "", height: "", transform: "none", translate: "none" };
      }) as typeof window.getComputedStyle);
    }

    function renderTwoTabs() {
      const result = mount(() => (
        <Tabs.Root defaultValue="one">
          <Tabs.List>
            <Tabs.Indicator data-testid="indicator" />
            <Tabs.Tab value="one">One</Tabs.Tab>
            <Tabs.Tab value="two">Two</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      tick();
      return result;
    }

    function indicatorLeft(el: ParentNode) {
      const indicator = el.querySelector('[data-testid="indicator"]') as HTMLElement;
      return {
        left: indicator.style.getPropertyValue(TabsIndicatorCssVars.activeTabLeft),
        right: indicator.style.getPropertyValue(TabsIndicatorCssVars.activeTabRight),
        width: indicator.style.getPropertyValue(TabsIndicatorCssVars.activeTabWidth),
      };
    }

    it("follows the tab's own 2D translation parsed from matrix()", async () => {
      const user = userEvent.setup();
      const { el } = renderTwoTabs();
      try {
        const list = el.querySelector('[role="tablist"]') as HTMLElement;
        const tab = screen.getByRole("tab", { name: "Two" }) as HTMLElement;
        mockTabLayout(tab, list);
        mockRect(tab, { left: 112, top: 4, width: 80, height: 32 });
        mockRect(list, { left: 0, top: 0, width: 400, height: 32 });
        mockTabTransform(tab, "matrix(1, 0, 0, 1, 12, 0)");

        await user.click(tab);
        tick();

        // Layout slot is at 100px; the tab-local translateX(12px) moves the rect to 112px.
        // The translation is stripped for the agreement check, so the precise rect wins.
        expect(indicatorLeft(el)).toEqual({ left: "112px", right: "208px", width: "80px" });
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("follows the tab's own translation parsed from matrix3d()", async () => {
      const user = userEvent.setup();
      const { el } = renderTwoTabs();
      try {
        const list = el.querySelector('[role="tablist"]') as HTMLElement;
        const tab = screen.getByRole("tab", { name: "Two" }) as HTMLElement;
        mockTabLayout(tab, list);
        mockRect(tab, { left: 112, top: 4, width: 80, height: 32 });
        mockRect(list, { left: 0, top: 0, width: 400, height: 32 });
        mockTabTransform(tab, "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 12, 0, 0, 1)");

        await user.click(tab);
        tick();

        expect(indicatorLeft(el)).toEqual({ left: "112px", right: "208px", width: "80px" });
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("falls back to the layout slot when a 3D ancestor warps the rects", async () => {
      const user = userEvent.setup();
      const { el } = renderTwoTabs();
      try {
        const list = el.querySelector('[role="tablist"]') as HTMLElement;
        const tab = screen.getByRole("tab", { name: "Two" }) as HTMLElement;
        mockTabLayout(tab, list);
        // Simulates a `rotateY` ancestor projecting the tab 150px away from its layout slot.
        mockRect(tab, { left: 250, top: 4, width: 80, height: 32 });
        mockRect(list, { left: 0, top: 0, width: 400, height: 32 });
        mockTabTransform(tab, "none");

        await user.click(tab);
        tick();

        expect(indicatorLeft(el)).toEqual({ left: "100px", right: "220px", width: "80px" });
      } finally {
        vi.restoreAllMocks();
      }
    });
  });
});
