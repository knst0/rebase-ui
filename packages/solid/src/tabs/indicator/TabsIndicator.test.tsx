import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { describeConformance, isJSDOM } from "#test-utils";

import * as Tabs from "../index.parts";
import * as TabsIndicatorCssVars from "./TabsIndicatorCssVars";
import * as TabsIndicatorDataAttributes from "./TabsIndicatorDataAttributes";

describe("<Tabs.Indicator />", () => {
  describeConformance(
    (props) => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Indicator {...props} />
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ),
    {
      defaultElement: "span",
      as: { targetElement: "section" },
      refInstanceof: window.HTMLSpanElement,
      stateAttributes: { [TabsIndicatorDataAttributes.orientation]: "horizontal" },
    },
  );

  it("renders with a presentation role", () => {
    const { container } = render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Indicator data-testid="indicator" />
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    expect(container.querySelector('[data-testid="indicator"]')).toHaveAttribute("role", "presentation");
  });

  it("renders nothing when no tab is selected", () => {
    const { container } = render(() => (
      <Tabs.Root value={null}>
        <Tabs.List>
          <Tabs.Indicator data-testid="indicator" />
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    expect(container.querySelector('[data-testid="indicator"]')).toBe(null);
  });

  it("sets the active tab css variables", () => {
    const { container } = render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Indicator data-testid="indicator" />
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const indicator = container.querySelector('[data-testid="indicator"]') as HTMLElement;

    expect(indicator.style.getPropertyValue(TabsIndicatorCssVars.activeTabLeft)).not.toBe("");
    expect(indicator.style.getPropertyValue(TabsIndicatorCssVars.activeTabWidth)).not.toBe("");
  });

  it("carries the orientation attribute", () => {
    const { container } = render(() => (
      <Tabs.Root defaultValue="two" orientation="vertical">
        <Tabs.List>
          <Tabs.Indicator data-testid="indicator" />
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const indicator = container.querySelector('[data-testid="indicator"]') as HTMLElement;

    expect(indicator).toHaveAttribute(TabsIndicatorDataAttributes.orientation, "vertical");
    expect(indicator).toHaveAttribute(TabsIndicatorDataAttributes.activationDirection, "none");
  });

  it.skipIf(isJSDOM)("tracks the activation direction", async () => {
    const user = userEvent.setup();
    const { container } = render(() => (
      <Tabs.Root defaultValue="two">
        <Tabs.List>
          <Tabs.Indicator data-testid="indicator" />
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    await user.click(screen.getAllByRole("tab")[0]);
    flush();

    expect(container.querySelector('[data-testid="indicator"]')).toHaveAttribute(TabsIndicatorDataAttributes.activationDirection, "left");
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
      return render(() => (
        <Tabs.Root defaultValue="one">
          <Tabs.List>
            <Tabs.Indicator data-testid="indicator" />
            <Tabs.Tab value="one">One</Tabs.Tab>
            <Tabs.Tab value="two">Two</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
    }

    function indicatorLeft(container: HTMLElement) {
      const indicator = container.querySelector('[data-testid="indicator"]') as HTMLElement;
      return {
        left: indicator.style.getPropertyValue(TabsIndicatorCssVars.activeTabLeft),
        right: indicator.style.getPropertyValue(TabsIndicatorCssVars.activeTabRight),
        width: indicator.style.getPropertyValue(TabsIndicatorCssVars.activeTabWidth),
      };
    }

    it("follows the tab's own 2D translation parsed from matrix()", async () => {
      const user = userEvent.setup();
      const { container } = renderTwoTabs();
      try {
        const list = container.querySelector('[role="tablist"]') as HTMLElement;
        const tab = screen.getByRole("tab", { name: "Two" }) as HTMLElement;
        mockTabLayout(tab, list);
        mockRect(tab, { left: 112, top: 4, width: 80, height: 32 });
        mockRect(list, { left: 0, top: 0, width: 400, height: 32 });
        mockTabTransform(tab, "matrix(1, 0, 0, 1, 12, 0)");

        await user.click(tab);

        // Layout slot is at 100px; the tab-local translateX(12px) moves the rect to 112px.
        // The translation is stripped for the agreement check, so the precise rect wins.
        expect(indicatorLeft(container)).toEqual({ left: "112px", right: "208px", width: "80px" });
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("follows the tab's own translation parsed from matrix3d()", async () => {
      const user = userEvent.setup();
      const { container } = renderTwoTabs();
      try {
        const list = container.querySelector('[role="tablist"]') as HTMLElement;
        const tab = screen.getByRole("tab", { name: "Two" }) as HTMLElement;
        mockTabLayout(tab, list);
        mockRect(tab, { left: 112, top: 4, width: 80, height: 32 });
        mockRect(list, { left: 0, top: 0, width: 400, height: 32 });
        mockTabTransform(tab, "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 12, 0, 0, 1)");

        await user.click(tab);

        expect(indicatorLeft(container)).toEqual({ left: "112px", right: "208px", width: "80px" });
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("falls back to the layout slot when a 3D ancestor warps the rects", async () => {
      const user = userEvent.setup();
      const { container } = renderTwoTabs();
      try {
        const list = container.querySelector('[role="tablist"]') as HTMLElement;
        const tab = screen.getByRole("tab", { name: "Two" }) as HTMLElement;
        mockTabLayout(tab, list);
        // Simulates a `rotateY` ancestor projecting the tab 150px away from its layout slot.
        mockRect(tab, { left: 250, top: 4, width: 80, height: 32 });
        mockRect(list, { left: 0, top: 0, width: 400, height: 32 });
        mockTabTransform(tab, "none");

        await user.click(tab);

        expect(indicatorLeft(container)).toEqual({ left: "100px", right: "220px", width: "80px" });
      } finally {
        vi.restoreAllMocks();
      }
    });
  });
});
