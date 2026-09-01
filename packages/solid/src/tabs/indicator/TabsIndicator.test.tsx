import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

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
});
