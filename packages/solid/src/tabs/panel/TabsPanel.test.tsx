import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { describeConformance } from "#test-utils";

import * as Tabs from "../index.parts";
import * as TabsPanelDataAttributes from "./TabsPanelDataAttributes";

const nextFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flush();
        resolve();
      });
    });
  });

describe("<Tabs.Panel />", () => {
  describeConformance(
    (props) => (
      <Tabs.Root defaultValue="one">
        <Tabs.Panel value="one" {...props} />
      </Tabs.Root>
    ),
    () => ({
      render,
      defaultElement: "div",
      as: { targetElement: "section" },
      refInstanceof: window.HTMLDivElement,
      stateAttributes: { [TabsPanelDataAttributes.orientation]: "horizontal" },
    }),
  );

  it("renders only the active panel by default", () => {
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one">Panel one</Tabs.Panel>
        <Tabs.Panel value="two">Panel two</Tabs.Panel>
      </Tabs.Root>
    ));

    const panels = screen.getAllByRole("tabpanel");

    expect(panels).toHaveLength(1);
    expect(panels[0]).toHaveTextContent("Panel one");
  });

  it("keeps hidden panels mounted with `keepMounted`", () => {
    const { container } = render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one" keepMounted>
          Panel one
        </Tabs.Panel>
        <Tabs.Panel value="two" keepMounted>
          Panel two
        </Tabs.Panel>
      </Tabs.Root>
    ));

    const panels = container.querySelectorAll('[role="tabpanel"]');

    expect(panels).toHaveLength(2);
    expect(panels[1]).toHaveAttribute("hidden");
    expect(panels[1]).toHaveAttribute(TabsPanelDataAttributes.hidden);
    expect(panels[1]).toHaveAttribute("inert");
  });

  it("switches the rendered panel when the tab changes", async () => {
    const user = userEvent.setup();
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one">Panel one</Tabs.Panel>
        <Tabs.Panel value="two">Panel two</Tabs.Panel>
      </Tabs.Root>
    ));

    await user.click(screen.getAllByRole("tab")[1]);
    flush();
    await nextFrames();

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel two");
  });

  it("sets `tabIndex` and `data-index`", () => {
    const { container } = render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one" keepMounted>
          Panel one
        </Tabs.Panel>
        <Tabs.Panel value="two" keepMounted>
          Panel two
        </Tabs.Panel>
      </Tabs.Root>
    ));

    const panels = container.querySelectorAll('[role="tabpanel"]');

    expect(panels[0]).toHaveAttribute("tabindex", "0");
    expect(panels[0]).toHaveAttribute(TabsPanelDataAttributes.index, "0");
    expect(panels[1]).toHaveAttribute("tabindex", "-1");
    expect(panels[1]).toHaveAttribute(TabsPanelDataAttributes.index, "1");
  });

  it("renders the `as` element", () => {
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.Panel as="section" value="one">
          Panel one
        </Tabs.Panel>
      </Tabs.Root>
    ));

    expect(screen.getByRole("tabpanel").tagName).toBe("SECTION");
  });
});
