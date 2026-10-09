import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { describeConformance, nextFrames } from "#test-utils";

import * as Collapsible from "../index.parts";
import * as CollapsibleRootDataAttributes from "./CollapsibleRootDataAttributes";

function renderCollapsible(props: Collapsible.Root.Props = {}, panelProps: Collapsible.Panel.Props = {}) {
  render(() => (
    <Collapsible.Root {...props}>
      <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      <Collapsible.Panel {...panelProps}>Content</Collapsible.Panel>
    </Collapsible.Root>
  ));

  const trigger = screen.getByRole("button");

  return {
    trigger,
    root: trigger.parentElement!,
    panel: () => screen.queryByText("Content"),
  };
}

async function clickTrigger(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.click(trigger);
  flush();
  await nextFrames();
}

describe("<Collapsible.Root />", () => {
  describeConformance(
    (props) => <Collapsible.Root {...props} />,
    () => ({
      defaultElement: "div",
      refInstanceof: window.HTMLDivElement,
      stateAttributes: { [CollapsibleRootDataAttributes.closed]: "" },
    }),
  );

  it.each([
    ["closed by default", {}, "false", false],
    ["open when `defaultOpen` is set", { defaultOpen: true }, "true", true],
  ])("renders %s", (_name, props, ariaExpanded, visible) => {
    const { trigger, panel } = renderCollapsible(props);

    expect(trigger).toHaveAttribute("aria-expanded", ariaExpanded);
    expect(panel()).toEqual(visible ? expect.anything() : null);
  });

  it("toggles the open state when the trigger is clicked", async () => {
    const user = userEvent.setup();
    const { trigger, root, panel } = renderCollapsible({}, { keepMounted: true });

    expect(root).toHaveAttribute(CollapsibleRootDataAttributes.closed, "");

    await clickTrigger(user, trigger);

    expect(root).toHaveAttribute(CollapsibleRootDataAttributes.open, "");
    expect(panel()).toBeVisible();

    await clickTrigger(user, trigger);

    expect(root).toHaveAttribute(CollapsibleRootDataAttributes.closed, "");
    expect(panel()).toHaveAttribute("hidden");
  });

  it("calls `onOpenChange` with the `trigger-press` reason", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const { trigger } = renderCollapsible({ onOpenChange });

    await clickTrigger(user, trigger);

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe("trigger-press");

    await clickTrigger(user, trigger);

    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange.mock.calls[1][0]).toBe(false);
  });

  it("supports canceling the change via `eventDetails.cancel()`", async () => {
    const onOpenChange = vi.fn((_open: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible({ onOpenChange }, { keepMounted: true });

    await clickTrigger(user, trigger);

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(panel()).toHaveAttribute("hidden");
  });

  it("stays open in controlled mode when the trigger is clicked", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible({ open: true, onOpenChange });

    await clickTrigger(user, trigger);

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
    expect(panel()).toBeVisible();
  });

  it("ignores trigger clicks when disabled", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible({ disabled: true, onOpenChange }, { keepMounted: true });

    await clickTrigger(user, trigger);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(panel()).toHaveAttribute("hidden");
  });
});
