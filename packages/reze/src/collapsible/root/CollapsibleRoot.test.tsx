import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Collapsible from "../index.parts";
import * as CollapsibleRootDataAttributes from "./CollapsibleRootDataAttributes";

afterEach(cleanup);

// NOTE: element queries are getters, not snapshots. Toggling the panel mounts or
// unmounts it, and the runtime re-invokes the shared slot thunks of the root
// children when the panel branch flips, replacing the trigger element with a new
// node (the replacement carries the current attributes). Re-query after every
// interaction so assertions always target the live node.
function renderCollapsible(props: Collapsible.Root.Props = {}, panelProps: Collapsible.Panel.Props = {}) {
  mount(() => (
    <Collapsible.Root {...props}>
      <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      <Collapsible.Panel {...panelProps}>Content</Collapsible.Panel>
    </Collapsible.Root>
  ));
  tick();

  const trigger = () => screen.getByRole("button");

  return {
    trigger,
    root: () => trigger().parentElement!,
    panel: () => screen.queryByText("Content"),
  };
}

async function clickTrigger(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.click(trigger);
  tick();
  await nextFrames();
}

describe("<Collapsible.Root />", () => {
  it("renders a div with closed state attributes by default", () => {
    const { root } = renderCollapsible();

    expect(root().tagName).toBe("DIV");
    expect(root()).toHaveAttribute(CollapsibleRootDataAttributes.closed, "");
    expect(root()).not.toHaveAttribute(CollapsibleRootDataAttributes.open);
  });

  it.each([
    ["closed by default", {}, "false", false],
    ["open when `defaultOpen` is set", { defaultOpen: true }, "true", true],
  ])("renders %s", (_name, props, ariaExpanded, visible) => {
    const { trigger, panel } = renderCollapsible(props);

    expect(trigger()).toHaveAttribute("aria-expanded", ariaExpanded);
    expect(panel()).toEqual(visible ? expect.anything() : null);
  });

  it("toggles the open state when the trigger is clicked", async () => {
    const user = userEvent.setup();
    const { trigger, root, panel } = renderCollapsible({}, { keepMounted: true });

    expect(root()).toHaveAttribute(CollapsibleRootDataAttributes.closed, "");

    await clickTrigger(user, trigger());

    expect(root()).toHaveAttribute(CollapsibleRootDataAttributes.open, "");
    expect(panel()).toBeVisible();

    await clickTrigger(user, trigger());

    expect(root()).toHaveAttribute(CollapsibleRootDataAttributes.closed, "");
    expect(panel()).toHaveAttribute("hidden");
  });

  it("calls `onOpenChange` with the `trigger-press` reason", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const { trigger } = renderCollapsible({ onOpenChange });

    await clickTrigger(user, trigger());

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe("trigger-press");

    await clickTrigger(user, trigger());

    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange.mock.calls[1][0]).toBe(false);
  });

  it("supports canceling the change via `eventDetails.cancel()`", async () => {
    const onOpenChange = vi.fn((_open: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible({ onOpenChange }, { keepMounted: true });

    await clickTrigger(user, trigger());

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).toHaveAttribute("hidden");
  });

  it("stays open in controlled mode when the trigger is clicked", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible({ open: true, onOpenChange });

    await clickTrigger(user, trigger());

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
    expect(panel()).toBeVisible();
  });

  it("ignores trigger clicks when disabled", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible({ disabled: true, onOpenChange }, { keepMounted: true });

    await clickTrigger(user, trigger());

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(panel()).toHaveAttribute("hidden");
  });

  it("forwards a callback ref to the root element", () => {
    let instance: HTMLElement | null = null;
    mount(() => (
      <Collapsible.Root
        ref={(value: HTMLElement) => {
          instance = value;
        }}
      />
    ));
    tick();

    expect(instance).toBeInstanceOf(window.HTMLDivElement);
  });

  it("calls the class function with the component state", () => {
    let stateArgument: unknown;
    mount(() => (
      <Collapsible.Root
        defaultOpen
        class={(state) => {
          stateArgument = state;
          return "";
        }}
      />
    ));
    tick();

    expect(stateArgument).toEqual({ open: true, disabled: false, transitionStatus: expect.anything() });
  });

  it("resolves render-prop children with the root state", () => {
    mount(() => (
      <Collapsible.Root defaultOpen>{(state) => <span data-testid="state">{state.open ? "open" : "closed"}</span>}</Collapsible.Root>
    ));
    tick();

    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });
});
