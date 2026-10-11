import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Accordion from "../index.parts";
import * as AccordionTriggerDataAttributes from "./AccordionTriggerDataAttributes";

afterEach(cleanup);

function renderTrigger(rootProps: Accordion.Root.Props = {}) {
  mount(() => (
    <Accordion.Root {...rootProps}>
      <Accordion.Item value="one">
        <Accordion.Header>
          <Accordion.Trigger>Trigger</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Panel</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ));
  tick();

  return { trigger: () => screen.getByRole("button") };
}

describe("<Accordion.Trigger />", () => {
  it("renders a native button by default", () => {
    const { trigger } = renderTrigger();

    expect(trigger().tagName).toBe("BUTTON");
    expect(trigger()).toHaveAttribute("type", "button");
  });

  it("links the panel and reflects the open state once opened", async () => {
    const user = userEvent.setup();
    const { trigger } = renderTrigger();

    expect(trigger()).not.toHaveAttribute("aria-controls");
    expect(trigger()).not.toHaveAttribute(AccordionTriggerDataAttributes.panelOpen);

    await user.click(trigger());
    tick();
    await nextFrames();

    const panel = screen.getByRole("region");

    expect(trigger()).toHaveAttribute("aria-controls", panel.id);
    expect(trigger()).toHaveAttribute(AccordionTriggerDataAttributes.panelOpen, "");
    expect(panel).toHaveAttribute("aria-labelledby", trigger().id);
  });

  it("renders the disabled attribute when disabled", () => {
    const { trigger } = renderTrigger({ disabled: true });

    expect(trigger()).toBeDisabled();
    expect(trigger()).not.toHaveAttribute("aria-disabled");
  });

  it("removes a disabled non-native trigger from the tab order", async () => {
    const user = userEvent.setup();
    mount(() => (
      <Accordion.Root>
        <Accordion.Item disabled>
          <Accordion.Header>
            <Accordion.Trigger nativeButton={false} as="span">
              Trigger
            </Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>
    ));
    tick();

    const trigger = screen.getByRole("button", { name: "Trigger" });

    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveAttribute("tabindex", "-1");
    expect(trigger).not.toHaveAttribute("disabled");

    await user.keyboard("[Tab]");
    expect(trigger).not.toHaveFocus();
  });

  it("does not render the root value as data-value", () => {
    mount(() => (
      <Accordion.Root value={["a", "b"]} multiple>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger>header a</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>panel a</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Header>
            <Accordion.Trigger>header b</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>panel b</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    tick();

    const triggers = screen.getAllByRole("button");

    expect(triggers[0]).not.toHaveAttribute("data-value");
    expect(triggers[1]).not.toHaveAttribute("data-value");
  });

  it("renders data-index on every trigger including the first", () => {
    mount(() => (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger>first</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger>second</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>
    ));
    tick();

    const triggers = screen.getAllByRole("button");

    expect(triggers[0]).toHaveAttribute(AccordionTriggerDataAttributes.index, "0");
    expect(triggers[1]).toHaveAttribute(AccordionTriggerDataAttributes.index, "1");
  });

  it("keeps data-panel-open instead of data-open", () => {
    mount(() => (
      <Accordion.Root value={["a"]}>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger>header a</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>panel a</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    tick();

    const trigger = screen.getByRole("button", { name: "header a" });

    expect(trigger).toHaveAttribute(AccordionTriggerDataAttributes.panelOpen, "");
    expect(trigger).not.toHaveAttribute("data-open");
  });

  it("opens on keyboard activation", async () => {
    const user = userEvent.setup();
    renderTrigger();

    await user.tab();
    await user.keyboard("[Enter]");
    tick();
    await nextFrames();

    expect(screen.getByRole("region")).toBeVisible();
  });
});
