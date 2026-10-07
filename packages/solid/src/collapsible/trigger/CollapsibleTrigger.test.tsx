import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { describeConformance } from "#test-utils";

import * as Collapsible from "../index.parts";
import * as CollapsibleTriggerDataAttributes from "./CollapsibleTriggerDataAttributes";

function renderCollapsible(rootProps: Collapsible.Root.Props = {}, panelProps: Collapsible.Panel.Props = {}) {
  render(() => (
    <Collapsible.Root {...rootProps}>
      <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      <Collapsible.Panel {...panelProps}>Content</Collapsible.Panel>
    </Collapsible.Root>
  ));

  return {
    trigger: screen.getByRole("button"),
    panel: () => screen.queryByText("Content"),
  };
}

async function clickTrigger(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.click(trigger);
  flush();
}

describe("<Collapsible.Trigger />", () => {
  describeConformance(
    (props) => (
      <Collapsible.Root>
        <Collapsible.Trigger {...props}>Trigger</Collapsible.Trigger>
      </Collapsible.Root>
    ),
    () => ({
      defaultElement: "button",
      refInstanceof: window.HTMLButtonElement,
    }),
  );

  it("toggles on click and updates the ARIA attributes", async () => {
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible();

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");
    expect(trigger).not.toHaveAttribute(CollapsibleTriggerDataAttributes.panelOpen);

    await clickTrigger(user, trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute(CollapsibleTriggerDataAttributes.panelOpen, "");
    expect(trigger).toHaveAttribute("aria-controls", panel()!.id);
  });

  it("drops `aria-controls` when the panel unmounts on close", async () => {
    const user = userEvent.setup();
    const { trigger } = renderCollapsible({ defaultOpen: true });

    expect(trigger.getAttribute("aria-controls")).toBeTruthy();

    await clickTrigger(user, trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");
  });

  it.each([
    ["keepMounted", { id: "kept-panel", keepMounted: true }],
    ["hiddenUntilFound", { id: "findable-panel", hiddenUntilFound: true }],
  ])("keeps the panel id in the DOM without `aria-controls` when closed with `%s`", async (_name, panelProps) => {
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible({ defaultOpen: true }, panelProps);

    await clickTrigger(user, trigger);

    expect(panel()).toHaveAttribute("id", panelProps.id);
    expect(trigger).not.toHaveAttribute("aria-controls");
  });

  it("reuses the same panel id after reopening", async () => {
    const user = userEvent.setup();
    const { trigger } = renderCollapsible();

    await clickTrigger(user, trigger);
    const panelId = trigger.getAttribute("aria-controls");

    await clickTrigger(user, trigger);
    await clickTrigger(user, trigger);

    expect(trigger).toHaveAttribute("aria-controls", panelId);
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("toggles on %s", async (_name, key) => {
    const user = userEvent.setup();
    const { trigger } = renderCollapsible({}, { keepMounted: true });

    trigger.focus();
    await user.keyboard(key);
    flush();

    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard(key);
    flush();

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("does not toggle when disabled but remains focusable", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger disabled>Trigger</Collapsible.Trigger>
        <Collapsible.Panel keepMounted>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const trigger = screen.getByRole("button");

    expect(trigger).not.toHaveAttribute("disabled");

    await clickTrigger(user, trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Content")).toHaveAttribute("hidden");
  });

  it("inherits `disabled` from the root", async () => {
    const user = userEvent.setup();
    const { trigger } = renderCollapsible({ disabled: true }, { keepMounted: true });

    await clickTrigger(user, trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
