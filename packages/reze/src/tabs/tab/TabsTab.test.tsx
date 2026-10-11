import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Tabs from "../index.parts";
import * as TabsTabDataAttributes from "./TabsTabDataAttributes";

afterEach(cleanup);

describe("<Tabs.Tab />", () => {
  it("renders a button element by default", () => {
    mount(() => (
      <Tabs.Root>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(screen.getByRole("tab").tagName).toBe("BUTTON");
  });

  it("renders the customized tab element", () => {
    mount(() => (
      <Tabs.Root>
        <Tabs.List>
          <Tabs.Tab value="one" nativeButton={false} as="span">
            One
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(screen.getByRole("tab").tagName).toBe("SPAN");
  });

  it("attaches a callback ref to the tab element", () => {
    let instance: HTMLElement | null = null;
    mount(() => (
      <Tabs.Root>
        <Tabs.List>
          <Tabs.Tab
            value="one"
            ref={(value: HTMLElement) => {
              instance = value;
            }}
          >
            One
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(instance).toBe(screen.getByRole("tab"));
  });

  it("defaults the native tab type to button", () => {
    mount(() => (
      <Tabs.Root>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(screen.getByRole("tab")).toHaveAttribute("type", "button");
  });

  it("selects the tab on click", async () => {
    const user = userEvent.setup();
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    const [tab1, tab2] = screen.getAllByRole("tab");

    await user.click(tab2);
    tick();

    expect(tab1).toHaveAttribute("aria-selected", "false");
    expect(tab2).toHaveAttribute("aria-selected", "true");
    expect(tab2).toHaveAttribute(TabsTabDataAttributes.active);
  });

  it("does not select a disabled tab", async () => {
    const user = userEvent.setup();
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two" disabled>
            Two
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab2).toHaveAttribute(TabsTabDataAttributes.disabled);

    await user.click(tab2);
    tick();

    expect(tab1).toHaveAttribute("aria-selected", "true");
    expect(tab2).toHaveAttribute("aria-selected", "false");
  });

  it("is focusable when disabled", () => {
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two" disabled>
            Two
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    const tab2 = screen.getAllByRole("tab")[1];

    expect(tab2).toHaveAttribute("aria-disabled", "true");
    expect(tab2).not.toHaveAttribute("disabled");
  });

  it("selects the tab on Enter", () => {
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    const [, tab2] = screen.getAllByRole("tab");

    tab2.focus();
    tick();

    fire(tab2, "keydown", { key: "Enter" } as KeyboardEventInit);
    fire(tab2, "click", { detail: 0 } as MouseEventInit);
    fire(tab2, "keyup", { key: "Enter" } as KeyboardEventInit);
    tick();

    expect(tab2).toHaveAttribute("aria-selected", "true");
  });

  it("links the tab to its panel", () => {
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one">Panel one</Tabs.Panel>
      </Tabs.Root>
    ));
    tick();

    const tab = screen.getByRole("tab");
    const panel = screen.getByRole("tabpanel");

    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });

  it("drops `aria-controls` while the matching panel is unmounted", async () => {
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

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab1).toHaveAttribute("aria-controls");
    expect(tab2).not.toHaveAttribute("aria-controls");

    await user.click(tab2);
    tick();
    await nextFrames();

    const [freshTab1, freshTab2] = screen.getAllByRole("tab");
    expect(freshTab1).not.toHaveAttribute("aria-controls");
    expect(freshTab2).toHaveAttribute("aria-controls", screen.getByRole("tabpanel").id);
  });

  it("keeps `aria-controls` pointing at a kept-mounted panel", () => {
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="two" keepMounted>
          Panel two
        </Tabs.Panel>
      </Tabs.Root>
    ));
    tick();

    const panel = screen.getByRole("tabpanel", { hidden: true });
    expect(screen.getByRole("tab")).toHaveAttribute("aria-controls", panel.id);
  });

  it("derives distinct panel ids per root and per value", () => {
    mount(() => (
      <>
        <Tabs.Root defaultValue="one">
          <Tabs.List>
            <Tabs.Tab value="one">One</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="one" keepMounted>
            A
          </Tabs.Panel>
          <Tabs.Panel value="needs escaping/1" keepMounted>
            B
          </Tabs.Panel>
        </Tabs.Root>
        <Tabs.Root defaultValue="one">
          <Tabs.List>
            <Tabs.Tab value="one">One</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="one" keepMounted>
            C
          </Tabs.Panel>
        </Tabs.Root>
      </>
    ));
    tick();

    const ids = screen.getAllByRole("tabpanel", { hidden: true }).map((panel) => panel.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_:.-]+$/);
      expect(document.querySelectorAll(`#${CSS.escape(id)}`)).toHaveLength(1);
    }
  });

  it("honors an explicit `id`", () => {
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one" id="custom-tab">
            One
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    expect(screen.getByRole("tab")).toHaveAttribute("id", "custom-tab");
  });

  it("gives the active tab the roving tab stop", () => {
    mount(() => (
      <Tabs.Root defaultValue="two">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab1).toHaveAttribute("tabindex", "-1");
    expect(tab2).toHaveAttribute("tabindex", "0");
  });

  it("calls a user `onClick` and still selects the tab", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    mount(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two" onClick={handleClick}>
            Two
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    tick();

    await user.click(screen.getAllByRole("tab")[1]);
    tick();

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("tab")[1]).toHaveAttribute("aria-selected", "true");
  });

  describe("render props", () => {
    it("calls the class function with the component state", () => {
      let stateArgument: unknown;
      mount(() => (
        <Tabs.Root defaultValue="one">
          <Tabs.List>
            <Tabs.Tab
              value="one"
              class={(state) => {
                stateArgument = state;
                return "";
              }}
            >
              One
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      tick();

      expect(screen.getByRole("tab")).toBeTruthy();
      expect(stateArgument).toEqual({
        active: true,
        disabled: false,
        orientation: "horizontal",
        tabActivationDirection: "none",
      });
    });

    it("renders children defined as a function of state", () => {
      mount(() => (
        <Tabs.Root defaultValue="one">
          <Tabs.List>
            <Tabs.Tab value="one">{(state) => (state.active ? "Active" : "Idle")}</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      tick();

      expect(screen.getByRole("tab").textContent).toBe("Active");
    });
  });
});
