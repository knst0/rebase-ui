import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { describeConformance, isJSDOM } from "#test-utils";

import * as Tabs from "../index.parts";
import * as TabsTabDataAttributes from "../tab/TabsTabDataAttributes";
import type { TabsRootChangeEventDetails } from "./TabsRoot";
import * as TabsRootDataAttributes from "./TabsRootDataAttributes";

describe("<Tabs.Root />", () => {
  describeConformance(
    (props) => <Tabs.Root {...props} />,
    () => ({
      render,
      defaultElement: "div",
      testAsWith: "section",
      refInstanceof: window.HTMLDivElement,
    }),
  );

  it("sets `data-orientation`", () => {
    const { container } = render(() => <Tabs.Root orientation="vertical" />);

    expect(container.firstElementChild).toHaveAttribute(TabsRootDataAttributes.orientation, "vertical");
  });

  it("selects the first tab by default", () => {
    render(() => (
      <Tabs.Root>
        <Tabs.List>
          <Tabs.Tab value={0}>One</Tabs.Tab>
          <Tabs.Tab value={1}>Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab1).toHaveAttribute("aria-selected", "true");
    expect(tab1).toHaveAttribute(TabsTabDataAttributes.active);
    expect(tab2).toHaveAttribute("aria-selected", "false");
  });

  it("honors `defaultValue`", () => {
    render(() => (
      <Tabs.Root defaultValue="two">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab1).toHaveAttribute("aria-selected", "false");
    expect(tab2).toHaveAttribute("aria-selected", "true");
  });

  it("selects no tab when the value is null", () => {
    render(() => (
      <Tabs.Root value={null}>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-selected", "false");
    }
  });

  it("updates when the controlled value changes", () => {
    const [value, setValue] = createSignal("one");

    render(() => (
      <Tabs.Root value={value()}>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab1).toHaveAttribute("aria-selected", "true");

    setValue("two");
    flush();

    expect(tab1).toHaveAttribute("aria-selected", "false");
    expect(tab2).toHaveAttribute("aria-selected", "true");
  });

  it.skipIf(isJSDOM)("calls `onValueChange` with the reason and activation direction", async () => {
    const onValueChange = vi.fn();

    const user = userEvent.setup();
    render(() => (
      <Tabs.Root defaultValue="one" onValueChange={onValueChange}>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    await user.click(screen.getAllByRole("tab")[1]);
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe("two");
    expect(onValueChange.mock.calls[0][1].reason).toBe("none");
    expect(onValueChange.mock.calls[0][1].activationDirection).toBe("right");
  });

  it("does not change the value when the event is canceled", async () => {
    const user = userEvent.setup();
    render(() => (
      <Tabs.Root defaultValue="one" onValueChange={(_value: unknown, eventDetails: TabsRootChangeEventDetails) => eventDetails.cancel()}>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const [tab1, tab2] = screen.getAllByRole("tab");

    await user.click(tab2);
    flush();

    expect(tab1).toHaveAttribute("aria-selected", "true");
    expect(tab2).toHaveAttribute("aria-selected", "false");
  });

  it("falls back to the first enabled tab when the implicit initial value is disabled", () => {
    const onValueChange = vi.fn();

    render(() => (
      <Tabs.Root onValueChange={onValueChange}>
        <Tabs.List>
          <Tabs.Tab value={0} disabled>
            One
          </Tabs.Tab>
          <Tabs.Tab value={1}>Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab1).toHaveAttribute("aria-selected", "false");
    expect(tab2).toHaveAttribute("aria-selected", "true");
    expect(onValueChange.mock.calls[0][1].reason).toBe("initial");
  });

  it("honors an explicit `defaultValue` pointing at a disabled tab", () => {
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one" disabled>
            One
          </Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    expect(screen.getAllByRole("tab")[0]).toHaveAttribute("aria-selected", "true");
  });

  it("keeps a controlled value that matches no tab", () => {
    render(() => (
      <Tabs.Root value="missing">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-selected", "false");
    }
  });

  it.skipIf(isJSDOM)("sets `data-activation-direction` on the root", async () => {
    const user = userEvent.setup();
    const { container } = render(() => (
      <Tabs.Root defaultValue="two">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    expect(container.firstElementChild).toHaveAttribute(TabsRootDataAttributes.activationDirection, "none");

    await user.click(screen.getAllByRole("tab")[0]);
    flush();

    expect(container.firstElementChild).toHaveAttribute(TabsRootDataAttributes.activationDirection, "left");
  });

  it.skipIf(isJSDOM)("mirrors the horizontal activation direction in a right-to-left list", async () => {
    const user = userEvent.setup();
    const { container } = render(() => (
      <Tabs.Root defaultValue="one" dir="rtl">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    await user.click(screen.getAllByRole("tab")[1]);
    flush();

    expect(container.firstElementChild).toHaveAttribute(TabsRootDataAttributes.activationDirection, "left");

    await user.click(screen.getAllByRole("tab")[0]);
    flush();

    expect(container.firstElementChild).toHaveAttribute(TabsRootDataAttributes.activationDirection, "right");
  });

  it.skipIf(isJSDOM)("reports the vertical activation direction from document order", async () => {
    const user = userEvent.setup();
    const { container } = render(() => (
      <Tabs.Root defaultValue="one" orientation="vertical">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    await user.click(screen.getAllByRole("tab")[1]);
    flush();

    expect(container.firstElementChild).toHaveAttribute(TabsRootDataAttributes.activationDirection, "down");
  });

  it.skipIf(isJSDOM)("reads the activation direction without measuring tab rects", async () => {
    const user = userEvent.setup();
    const getBoundingClientRect = vi.spyOn(window.HTMLElement.prototype, "getBoundingClientRect");

    try {
      const { container } = render(() => (
        <Tabs.Root defaultValue="one">
          <Tabs.List>
            <Tabs.Tab value="one">One</Tabs.Tab>
            <Tabs.Tab value="two">Two</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));

      getBoundingClientRect.mockClear();
      await user.click(screen.getAllByRole("tab")[1]);
      flush();

      expect(container.firstElementChild).toHaveAttribute(TabsRootDataAttributes.activationDirection, "right");
      expect(getBoundingClientRect).not.toHaveBeenCalled();
    } finally {
      getBoundingClientRect.mockRestore();
    }
  });
});
