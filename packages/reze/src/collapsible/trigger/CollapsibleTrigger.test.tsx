import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Collapsible from "../index.parts";
import * as CollapsibleTriggerDataAttributes from "./CollapsibleTriggerDataAttributes";

afterEach(cleanup);

// NOTE: element queries are getters, not snapshots. Toggling the panel mounts or
// unmounts it, and the runtime re-invokes the shared slot thunks of the root
// children when the panel branch flips, replacing the trigger element with a new
// node (the replacement carries the current attributes). Re-query after every
// interaction so assertions always target the live node.
function renderCollapsible(rootProps: Collapsible.Root.Props = {}, panelProps: Collapsible.Panel.Props = {}) {
  mount(() => (
    <Collapsible.Root {...rootProps}>
      <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      <Collapsible.Panel {...panelProps}>Content</Collapsible.Panel>
    </Collapsible.Root>
  ));
  tick();

  return {
    trigger: () => screen.getByRole("button"),
    panel: () => screen.queryByText("Content"),
  };
}

async function clickTrigger(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.click(trigger);
  tick();
  await nextFrames();
}

describe("<Collapsible.Trigger />", () => {
  it("renders a button element by default", () => {
    const { trigger } = renderCollapsible();

    expect(trigger().tagName).toBe("BUTTON");
    expect(trigger()).toHaveAttribute("type", "button");
  });

  it("toggles on click and updates the ARIA attributes", async () => {
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible();

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).not.toHaveAttribute("aria-controls");
    expect(trigger()).not.toHaveAttribute(CollapsibleTriggerDataAttributes.panelOpen);

    await clickTrigger(user, trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger()).toHaveAttribute(CollapsibleTriggerDataAttributes.panelOpen, "");
    expect(trigger()).toHaveAttribute("aria-controls", panel()!.id);
  });

  it("drops `aria-controls` when the panel unmounts on close", async () => {
    const user = userEvent.setup();
    const { trigger } = renderCollapsible({ defaultOpen: true });

    expect(trigger().getAttribute("aria-controls")).toBeTruthy();

    await clickTrigger(user, trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).not.toHaveAttribute("aria-controls");
  });

  it.each([
    ["keepMounted", { id: "kept-panel", keepMounted: true }],
    ["hiddenUntilFound", { id: "findable-panel", hiddenUntilFound: true }],
  ])("keeps the panel id in the DOM without `aria-controls` when closed with `%s`", async (_name, panelProps) => {
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible({ defaultOpen: true }, panelProps);

    await clickTrigger(user, trigger());

    expect(panel()).toHaveAttribute("id", panelProps.id);
    expect(trigger()).not.toHaveAttribute("aria-controls");
  });

  it("reuses the same panel id after reopening", async () => {
    const user = userEvent.setup();
    const { trigger } = renderCollapsible();

    await clickTrigger(user, trigger());
    const panelId = trigger().getAttribute("aria-controls");

    await clickTrigger(user, trigger());
    await clickTrigger(user, trigger());

    expect(trigger()).toHaveAttribute("aria-controls", panelId);
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("toggles on %s", async (_name, key) => {
    const user = userEvent.setup();
    const { trigger } = renderCollapsible({}, { keepMounted: true });

    trigger().focus();
    await user.keyboard(key);
    tick();
    await nextFrames();

    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    trigger().focus();
    await user.keyboard(key);
    tick();
    await nextFrames();

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("renders the disabled attribute when disabled", async () => {
    const user = userEvent.setup();
    mount(() => (
      <Collapsible.Root disabled>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      </Collapsible.Root>
    ));
    tick();

    const trigger = () => screen.getByRole("button", { name: "Trigger" });

    expect(trigger()).toBeDisabled();
    expect(trigger()).not.toHaveAttribute("aria-disabled");

    await clickTrigger(user, trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("removes a disabled non-native trigger from the tab order", async () => {
    const user = userEvent.setup();
    mount(() => (
      <Collapsible.Root disabled>
        <Collapsible.Trigger nativeButton={false} as="span">
          Trigger
        </Collapsible.Trigger>
      </Collapsible.Root>
    ));
    tick();

    const trigger = screen.getByRole("button", { name: "Trigger" });

    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveAttribute("tabindex", "-1");
    expect(trigger).not.toHaveAttribute("disabled");

    await user.keyboard("[Tab]");
    expect(trigger).not.toHaveFocus();
  });

  it("does not toggle when disabled", async () => {
    const user = userEvent.setup();
    mount(() => (
      <Collapsible.Root>
        <Collapsible.Trigger disabled>Trigger</Collapsible.Trigger>
        <Collapsible.Panel keepMounted>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    tick();

    const trigger = () => screen.getByRole("button");

    expect(trigger()).toBeDisabled();

    await clickTrigger(user, trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Content")).toHaveAttribute("hidden");
  });

  it("inherits `disabled` from the root", async () => {
    const user = userEvent.setup();
    const { trigger } = renderCollapsible({ disabled: true }, { keepMounted: true });

    await clickTrigger(user, trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("forwards a callback ref to the trigger element", () => {
    let instance: HTMLElement | null = null;
    mount(() => (
      <Collapsible.Root>
        <Collapsible.Trigger
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        >
          Trigger
        </Collapsible.Trigger>
      </Collapsible.Root>
    ));
    tick();

    expect(instance).toBe(screen.getByRole("button"));
  });
});
