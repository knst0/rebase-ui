import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Tabs from "../index.parts";
import * as TabsPanelDataAttributes from "./TabsPanelDataAttributes";

afterEach(cleanup);

describe("<Tabs.Panel />", () => {
  it("renders a div element by default", () => {
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.Panel value="one">Panel one</Tabs.Panel>
      </Tabs.Root>
    ));
    tick();

    expect(screen.getByRole("tabpanel").tagName).toBe("DIV");
  });

  it("renders the `as` element", () => {
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.Panel as="section" value="one">
          Panel one
        </Tabs.Panel>
      </Tabs.Root>
    ));
    tick();

    expect(screen.getByRole("tabpanel").tagName).toBe("SECTION");
  });

  it("attaches a callback ref to the panel element", () => {
    let instance: HTMLElement | null = null;
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.Panel
          value="one"
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        >
          Panel one
        </Tabs.Panel>
      </Tabs.Root>
    ));
    tick();

    expect(instance).toBe(screen.getByRole("tabpanel"));
  });

  it("sets the state attributes", () => {
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.Panel value="one">Panel one</Tabs.Panel>
      </Tabs.Root>
    ));
    tick();

    expect(screen.getByRole("tabpanel")).toHaveAttribute(TabsPanelDataAttributes.orientation, "horizontal");
  });

  it("renders only the active panel by default", () => {
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one">Panel one</Tabs.Panel>
        <Tabs.Panel value="two">Panel two</Tabs.Panel>
      </Tabs.Root>
    ));
    tick();

    const panels = screen.getAllByRole("tabpanel");

    expect(panels).toHaveLength(1);
    expect(panels[0]).toHaveTextContent("Panel one");
  });

  it("keeps hidden panels mounted with `keepMounted`", () => {
    const { el } = mount(() => (
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
    tick();

    const panels = el.querySelectorAll('[role="tabpanel"]');

    expect(panels).toHaveLength(2);
    expect(panels[1]).toHaveAttribute("hidden");
    expect(panels[1]).toHaveAttribute(TabsPanelDataAttributes.hidden);
    expect(panels[1]).toHaveAttribute("inert");
    expect(panels[0]).not.toHaveAttribute("hidden");
    expect(panels[0]).not.toHaveAttribute("inert");
  });

  it("switches the rendered panel when the tab changes", async () => {
    const user = userEvent.setup();
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one">Panel one</Tabs.Panel>
        <Tabs.Panel value="two">Panel two</Tabs.Panel>
      </Tabs.Root>
    ));
    tick();

    await user.click(screen.getAllByRole("tab")[1]);
    tick();
    await nextFrames();

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel two");
  });

  it("sets `tabIndex` and `data-index`", () => {
    const { el } = mount(() => (
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
    tick();

    const panels = el.querySelectorAll('[role="tabpanel"]');

    expect(panels[0]).toHaveAttribute("tabindex", "0");
    expect(panels[0]).toHaveAttribute(TabsPanelDataAttributes.index, "0");
    expect(panels[1]).toHaveAttribute("tabindex", "-1");
    expect(panels[1]).toHaveAttribute(TabsPanelDataAttributes.index, "1");
  });

  describe("render props", () => {
    it("calls the class function with the component state", () => {
      let stateArgument: unknown;
      mount(() => (
        <Tabs.Root defaultValue="one">
          <Tabs.Panel
            value="one"
            class={(state) => {
              stateArgument = state;
              return "";
            }}
          >
            Panel one
          </Tabs.Panel>
        </Tabs.Root>
      ));
      tick();

      expect(screen.getByRole("tabpanel")).toBeTruthy();
      expect(stateArgument).toEqual({
        hidden: false,
        orientation: "horizontal",
        tabActivationDirection: "none",
        transitionStatus: undefined,
      });
    });

    it("renders children defined as a function of state", () => {
      mount(() => (
        <Tabs.Root defaultValue="one">
          <Tabs.Panel value="one">{(state) => (state.hidden ? "Hidden" : "Shown")}</Tabs.Panel>
        </Tabs.Root>
      ));
      tick();

      expect(screen.getByRole("tabpanel").textContent).toBe("Shown");
    });
  });
});
