import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import * as Accordion from "../index.parts";
import * as AccordionTriggerDataAttributes from "./AccordionTriggerDataAttributes";

function renderTrigger(rootProps: Accordion.Root.Props = {}) {
  render(() => (
    <Accordion.Root {...rootProps}>
      <Accordion.Item value="one">
        <Accordion.Header>
          <Accordion.Trigger>Trigger</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Panel</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ));

  return { trigger: screen.getByRole("button") };
}

describe("<Accordion.Trigger />", () => {
  it("renders a native button by default", () => {
    const { trigger } = renderTrigger();

    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("type", "button");
  });

  it("links the panel and reflects the open state once opened", async () => {
    const user = userEvent.setup();
    const { trigger } = renderTrigger();

    expect(trigger).not.toHaveAttribute("aria-controls");
    expect(trigger).not.toHaveAttribute(AccordionTriggerDataAttributes.panelOpen);

    await user.click(trigger);
    flush();

    const panel = screen.getByRole("region");

    expect(trigger).toHaveAttribute("aria-controls", panel.id);
    expect(trigger).toHaveAttribute(AccordionTriggerDataAttributes.panelOpen, "");
    expect(panel).toHaveAttribute("aria-labelledby", trigger.id);
  });

  it("stays focusable when disabled", () => {
    const { trigger } = renderTrigger({ disabled: true });

    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveAttribute("tabindex", "0");
  });

  it("opens on keyboard activation", async () => {
    const user = userEvent.setup();
    renderTrigger();

    await user.tab();
    await user.keyboard("[Enter]");
    flush();

    expect(screen.getByRole("region")).toBeVisible();
  });
});
