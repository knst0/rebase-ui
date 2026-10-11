import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { onCleanup, signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Collapsible from "../index.parts";
import * as CollapsiblePanelDataAttributes from "./CollapsiblePanelDataAttributes";

afterEach(cleanup);

// NOTE: element queries are getters, not snapshots. Toggling the panel mounts or
// unmounts it, and the runtime re-invokes the shared slot thunks of the root
// children when the panel branch flips, replacing the trigger element with a new
// node (the replacement carries the current attributes). Re-query after every
// interaction so assertions always target the live node.
function renderCollapsible(rootProps: Collapsible.Root.Props = {}, panelProps: Collapsible.Panel.Props = {}) {
  const mounted = mount(() => (
    <Collapsible.Root {...rootProps}>
      <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      <Collapsible.Panel {...panelProps}>Content</Collapsible.Panel>
    </Collapsible.Root>
  ));
  tick();

  return {
    container: mounted.el,
    trigger: () => screen.getByRole("button"),
    panel: () => screen.queryByText("Content"),
  };
}

async function clickTrigger(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.click(trigger);
  tick();
  await nextFrames();
}

function RemovablePanelInner(props: Record<string, any>) {
  // Reze does not null function refs on unmount, so clear the panel ref
  // explicitly to mirror a render function dropping the element.
  onCleanup(() => {
    props.ref?.(null);
  });

  return <div {...props} />;
}

// Context does not flow through dynamicElement, so an `as` component cannot read the
// root context. The open state is mirrored into a test-owned signal via `onOpenChange`
// instead, which drives the same conditional removal.
function createRemovablePanel(isOpen: () => boolean) {
  return function RemovablePanel(props: Record<string, any>) {
    return <>{isOpen() && <RemovablePanelInner {...props} />}</>;
  };
}

describe("<Collapsible.Panel />", () => {
  it("renders a div element when open", () => {
    const { panel } = renderCollapsible({ defaultOpen: true });

    expect(panel()!.tagName).toBe("DIV");
  });

  it("does not render the panel while closed", () => {
    const { panel } = renderCollapsible();

    expect(panel()).not.toBeInTheDocument();
  });

  it("renders the panel when opened", async () => {
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible();

    await clickTrigger(user, trigger());

    expect(panel()).toBeVisible();
    expect(panel()).not.toHaveAttribute("hidden");
    expect(panel()).toHaveAttribute(CollapsiblePanelDataAttributes.open, "");
  });

  it("keeps the panel mounted with `keepMounted`", async () => {
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible({}, { keepMounted: true });

    expect(panel()).toHaveAttribute("hidden");
    expect(panel()).toHaveAttribute(CollapsiblePanelDataAttributes.closed, "");

    await clickTrigger(user, trigger());

    expect(panel()).not.toHaveAttribute("hidden");
    expect(panel()).toHaveAttribute(CollapsiblePanelDataAttributes.open, "");
  });

  it.each([
    ["a custom", { id: "custom-panel" }, "custom-panel"],
    ["a generated", {}, undefined],
  ])("links %s panel id to the trigger", (_name, panelProps, expectedId) => {
    const { trigger, panel } = renderCollapsible({ defaultOpen: true }, panelProps);

    const panelId = expectedId ?? panel()!.id;

    expect(panelId).toBeTruthy();
    expect(panel()).toHaveAttribute("id", panelId);
    expect(trigger()).toHaveAttribute("aria-controls", panelId);
  });

  it("keeps the panel in the DOM with `hiddenUntilFound` and reveals it on `beforematch`", async () => {
    const onOpenChange = vi.fn();
    const { container, trigger, panel } = renderCollapsible({ onOpenChange }, { hiddenUntilFound: true });

    expect(panel()).toHaveAttribute("hidden", "until-found");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");

    panel()!.dispatchEvent(new Event("beforematch"));
    tick();
    await nextFrames();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe("none");
    expect(panel()).not.toHaveAttribute("hidden");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(container.contains(panel())).toBe(true);
  });

  it("supports canceling the `beforematch` open change", () => {
    const onOpenChange = vi.fn((_open: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });
    const { panel } = renderCollapsible({ onOpenChange }, { hiddenUntilFound: true });

    panel()!.dispatchEvent(new Event("beforematch"));
    tick();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(panel()).toHaveAttribute("hidden", "until-found");
  });

  it("drops starting styles synchronously while `beforematch` is being dispatched", () => {
    const { panel } = renderCollapsible({}, { hiddenUntilFound: true });

    panel()!.setAttribute(CollapsiblePanelDataAttributes.startingStyle, "");

    let startingStyleWhenRevealed: boolean | undefined;
    // Registered after the component's own listener, so this observes the panel
    // from where the browser does: once `beforematch` handling is done.
    panel()!.addEventListener("beforematch", () => {
      startingStyleWhenRevealed = panel()!.hasAttribute(CollapsiblePanelDataAttributes.startingStyle);
    });

    panel()!.dispatchEvent(new Event("beforematch"));

    expect(startingStyleWhenRevealed).toBe(false);
  });

  it("restores `hidden='until-found'` when the `beforematch` reveal is canceled", async () => {
    const onOpenChange = vi.fn((_open: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });
    const { panel } = renderCollapsible({ onOpenChange }, { hiddenUntilFound: true });

    panel()!.dispatchEvent(new Event("beforematch"));
    // The browser drops `hidden` as part of revealing the match, regardless of
    // what the event handler decided.
    panel()!.removeAttribute("hidden");
    tick();

    await vi.waitFor(() => {
      expect(panel()).toHaveAttribute("hidden", "until-found");
    });
  });

  it("re-collapses the panel when the open state never arrives", async () => {
    // Controlled without a state update: the `beforematch` open is ignored.
    const { panel, trigger } = renderCollapsible({ open: () => false, onOpenChange: () => {} }, { hiddenUntilFound: true });

    panel()!.setAttribute(CollapsiblePanelDataAttributes.startingStyle, "");
    panel()!.dispatchEvent(new Event("beforematch"));
    // The browser drops `hidden` as part of revealing the match.
    panel()!.removeAttribute("hidden");
    tick();

    await vi.waitFor(() => {
      expect(panel()).toHaveAttribute("hidden", "until-found");
    });
    expect(panel()).toHaveAttribute(CollapsiblePanelDataAttributes.startingStyle, "");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("cancels a scheduled reveal revert when the panel unmounts", async () => {
    const onOpenChange = vi.fn((_open: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });
    mount(() => (
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel hiddenUntilFound>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    tick();

    const panel = screen.getByText("Content");

    panel.dispatchEvent(new Event("beforematch"));
    panel.removeAttribute("hidden");
    cleanup();
    tick();
    await nextFrames();

    // The scheduled timeout and frame were cleared; nothing touches the detached panel.
    expect(panel.hasAttribute("hidden")).toBe(false);
  });

  it("finishes closing when the render function removes the panel element", async () => {
    const onOpenChange = vi.fn();
    let panelOpen = signal(true);
    const RemovablePanel = createRemovablePanel(() => panelOpen);
    const user = userEvent.setup();
    mount(() => (
      <Collapsible.Root
        defaultOpen
        onOpenChange={(open, eventDetails) => {
          panelOpen = open;
          onOpenChange(open, eventDetails);
        }}
      >
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel as={RemovablePanel}>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    tick();

    const trigger = () => screen.getByRole("button", { name: "Trigger" });

    expect(screen.getByText("Content")).toHaveAttribute("data-open");

    await user.click(trigger());
    tick();
    await nextFrames();
    await nextFrames();

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Content")).toBe(null);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    // Closing settles even though no element is left to animate.
    expect(trigger()).not.toHaveAttribute("data-ending-style");
  });

  it("animates on reopen after an initially open panel is removed by the render function", async () => {
    let panelOpen = signal(true);
    const RemovablePanel = createRemovablePanel(() => panelOpen);
    const user = userEvent.setup();
    mount(() => (
      <Collapsible.Root
        defaultOpen
        onOpenChange={(open) => {
          panelOpen = open;
        }}
      >
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel as={RemovablePanel}>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    tick();

    const trigger = () => screen.getByRole("button", { name: "Trigger" });

    // The initial mount animation is suppressed while the panel starts open.
    // happy-dom cannot run real CSS animations, so the test observes the inline
    // suppression style directly instead of the running animation.
    expect(screen.getByText("Content").style.getPropertyValue("animation-name")).toBe("none");

    await user.click(trigger());
    tick();
    await nextFrames();
    await nextFrames();

    expect(screen.queryByText("Content")).toBe(null);

    await user.click(trigger());
    tick();
    await nextFrames();

    const panel = screen.getByText("Content");

    expect(panel).toHaveAttribute("data-open");
    // The next open animates normally: no mount-animation suppression is left.
    expect(panel.style.getPropertyValue("animation-name")).toBe("");
  });

  it("forwards a callback ref to the panel element", () => {
    let instance: HTMLElement | null = null;
    mount(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Panel
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        >
          Content
        </Collapsible.Panel>
      </Collapsible.Root>
    ));
    tick();

    expect(instance).toBe(screen.getByText("Content"));
  });
});
