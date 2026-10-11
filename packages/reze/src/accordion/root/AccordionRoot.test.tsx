import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Accordion from "../index.parts";
import * as AccordionItemDataAttributes from "../item/AccordionItemDataAttributes";

afterEach(cleanup);

const PANEL_ONE = "Panel contents 1";
const PANEL_TWO = "Panel contents 2";

function renderAccordion(props: Accordion.Root.Props = {}) {
  mount(() => (
    <Accordion.Root {...props}>
      <Accordion.Item value="one" data-testid="item-one">
        <Accordion.Header>
          <Accordion.Trigger>Trigger 1</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>{PANEL_ONE}</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="two" data-testid="item-two">
        <Accordion.Header>
          <Accordion.Trigger>Trigger 2</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>{PANEL_TWO}</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ));
  tick();

  return {
    triggers: () => screen.getAllByRole("button"),
    panels: () => [screen.queryByText(PANEL_ONE), screen.queryByText(PANEL_TWO)],
  };
}

async function clickTrigger(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.click(trigger);
  tick();
  await nextFrames();
}

describe("<Accordion.Root />", () => {
  it("renders a div by default and forwards a ref", () => {
    let instance: HTMLElement | null = null;
    mount(() => (
      <Accordion.Root
        ref={(value: HTMLElement) => {
          instance = value;
        }}
      />
    ));
    tick();

    expect(instance).toBeInstanceOf(window.HTMLDivElement);
  });

  it("renders the customized root element", () => {
    mount(() => <Accordion.Root as="section" data-testid="root" />);
    tick();

    expect(screen.getByTestId("root").tagName).toBe("SECTION");
  });

  it("renders all panels closed by default", () => {
    const { triggers, panels } = renderAccordion();

    expect(panels()).toEqual([null, null]);

    for (const trigger of triggers()) {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("opens the item matching `defaultValue`", () => {
    const { panels } = renderAccordion({ defaultValue: ["two"] });

    expect(panels()[0]).toBe(null);
    expect(panels()[1]).toBeVisible();
  });

  it("opens a panel when its trigger is clicked", async () => {
    const user = userEvent.setup();
    const { triggers, panels } = renderAccordion();

    await clickTrigger(user, triggers()[0]);

    expect(panels()[0]).toBeVisible();
    expect(triggers()[0]).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the previously open item when `multiple` is false", async () => {
    const user = userEvent.setup();
    const { triggers, panels } = renderAccordion({ defaultValue: ["one"] });

    await clickTrigger(user, triggers()[1]);

    expect(panels()[0]).toBe(null);
    expect(panels()[1]).toBeVisible();
  });

  it("keeps items open independently when `multiple` is true", async () => {
    const user = userEvent.setup();
    const { triggers, panels } = renderAccordion({ defaultValue: ["one"], multiple: true });

    await clickTrigger(user, triggers()[1]);

    expect(panels()[0]).toBeVisible();
    expect(panels()[1]).toBeVisible();
  });

  it("toggles an open item closed when clicked again", async () => {
    const user = userEvent.setup();
    const { triggers, panels } = renderAccordion({ defaultValue: ["one"] });

    await clickTrigger(user, triggers()[0]);

    expect(panels()[0]).toBe(null);
  });

  it("calls `onValueChange` with the next value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { triggers } = renderAccordion({ onValueChange });

    await clickTrigger(user, triggers()[0]);

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toEqual(["one"]);
  });

  it.each([
    ["the change is canceled", { onValueChange: (_v: any, d: Accordion.Root.ChangeEventDetails) => d.cancel() }],
    ["the root is disabled", { disabled: true }],
  ])("does not open when %s", async (_name, props) => {
    const user = userEvent.setup();
    const { triggers, panels } = renderAccordion(props);

    await clickTrigger(user, triggers()[0]);

    expect(panels()[0]).toBe(null);
  });

  it("respects the controlled `value` prop", async () => {
    const user = userEvent.setup();
    const { triggers, panels } = renderAccordion({ value: ["one"] });

    await clickTrigger(user, triggers()[0]);

    expect(panels()[0]).toBeVisible();
  });

  it("sets the item index state attribute", () => {
    renderAccordion();
    tick();

    expect(screen.getByTestId("item-one")).toHaveAttribute(AccordionItemDataAttributes.index, "0");
    expect(screen.getByTestId("item-two")).toHaveAttribute(AccordionItemDataAttributes.index, "1");
  });
});
