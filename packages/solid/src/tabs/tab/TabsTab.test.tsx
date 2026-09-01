import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { describeConformance } from "#test-utils";

import * as Tabs from "../index.parts";
import * as TabsTabDataAttributes from "./TabsTabDataAttributes";

const nextFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flush();
        resolve();
      });
    });
  });

describe("<Tabs.Tab />", () => {
  function renderInTabs(tab: (props: Record<string, any>) => any, props: Record<string, any>) {
    return (
      <Tabs.Root defaultValue="one">
        <Tabs.List>{tab(props)}</Tabs.List>
      </Tabs.Root>
    );
  }

  describe("native tab", () => {
    describeConformance(
      (props) => renderInTabs((tabProps) => <Tabs.Tab value="one" {...tabProps} />, props),
      () => ({
        render,
        defaultElement: "button",
        refInstanceof: window.HTMLButtonElement,
        skip: ["as"],
      }),
    );
  });

  describe("non-native tab", () => {
    describeConformance(
      (props) => renderInTabs((tabProps) => <Tabs.Tab nativeButton={false} as="span" value="one" {...tabProps} />, props),
      () => ({
        render,
        defaultElement: "span",
        testAsWith: "section",
        refInstanceof: window.HTMLSpanElement,
      }),
    );
  });

  it("defaults the native tab type to button", () => {
    render(() => (
      <Tabs.Root>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    expect(screen.getByRole("tab")).toHaveAttribute("type", "button");
  });

  it("selects the tab on click", async () => {
    const user = userEvent.setup();
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const [tab1, tab2] = screen.getAllByRole("tab");

    await user.click(tab2);
    flush();

    expect(tab1).toHaveAttribute("aria-selected", "false");
    expect(tab2).toHaveAttribute("aria-selected", "true");
    expect(tab2).toHaveAttribute(TabsTabDataAttributes.active);
  });

  it("does not select a disabled tab", async () => {
    const user = userEvent.setup();
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two" disabled>
            Two
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab2).toHaveAttribute(TabsTabDataAttributes.disabled);

    await user.click(tab2);
    flush();

    expect(tab1).toHaveAttribute("aria-selected", "true");
    expect(tab2).toHaveAttribute("aria-selected", "false");
  });

  it("is focusable when disabled", () => {
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two" disabled>
            Two
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const tab2 = screen.getAllByRole("tab")[1];

    expect(tab2).toHaveAttribute("aria-disabled", "true");
    expect(tab2).not.toHaveAttribute("disabled");
  });

  it("selects the tab on Enter", () => {
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const [, tab2] = screen.getAllByRole("tab");

    tab2.focus();
    flush();

    fireEvent.keyDown(tab2, { key: "Enter" });
    fireEvent.click(tab2, { detail: 0 });
    fireEvent.keyUp(tab2, { key: "Enter" });
    flush();

    expect(tab2).toHaveAttribute("aria-selected", "true");
  });

  it("links the tab to its panel", () => {
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one">Panel one</Tabs.Panel>
      </Tabs.Root>
    ));

    const tab = screen.getByRole("tab");
    const panel = screen.getByRole("tabpanel");

    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });

  it("drops `aria-controls` while the matching panel is unmounted", async () => {
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

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab1).toHaveAttribute("aria-controls");
    expect(tab2).not.toHaveAttribute("aria-controls");

    await user.click(tab2);
    await nextFrames();

    expect(tab1).not.toHaveAttribute("aria-controls");
    expect(tab2).toHaveAttribute("aria-controls", screen.getByRole("tabpanel").id);
  });

  it("keeps `aria-controls` pointing at a kept-mounted panel", () => {
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="two" keepMounted>
          Panel two
        </Tabs.Panel>
      </Tabs.Root>
    ));

    const panel = screen.getByRole("tabpanel", { hidden: true });
    expect(screen.getByRole("tab")).toHaveAttribute("aria-controls", panel.id);
  });

  it("derives distinct panel ids per root and per value", () => {
    render(() => (
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

    const ids = screen.getAllByRole("tabpanel", { hidden: true }).map((panel) => panel.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_:.-]+$/);
      expect(document.querySelectorAll(`#${CSS.escape(id)}`)).toHaveLength(1);
    }
  });

  it("honors an explicit `id`", () => {
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one" id="custom-tab">
            One
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    expect(screen.getByRole("tab")).toHaveAttribute("id", "custom-tab");
  });

  it("gives the active tab the roving tab stop", () => {
    render(() => (
      <Tabs.Root defaultValue="two">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));

    const [tab1, tab2] = screen.getAllByRole("tab");

    expect(tab1).toHaveAttribute("tabindex", "-1");
    expect(tab2).toHaveAttribute("tabindex", "0");
  });
});
