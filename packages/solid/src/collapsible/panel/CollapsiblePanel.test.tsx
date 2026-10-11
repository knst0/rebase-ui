import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush, onCleanup, Show } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { describeConformance, isJSDOM, nextFrames } from "#test-utils";

import * as Collapsible from "../index.parts";
import { useCollapsibleRootContext } from "../root/CollapsibleRootContext";
import * as CollapsiblePanelDataAttributes from "./CollapsiblePanelDataAttributes";

function renderCollapsible(rootProps: Collapsible.Root.Props = {}, panelProps: Collapsible.Panel.Props = {}) {
  const result = render(() => (
    <Collapsible.Root {...rootProps}>
      <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      <Collapsible.Panel {...panelProps}>Content</Collapsible.Panel>
    </Collapsible.Root>
  ));

  return {
    container: result.container,
    trigger: screen.getByRole("button"),
    panel: () => screen.queryByText("Content"),
  };
}

async function clickTrigger(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.click(trigger);
  flush();
  await nextFrames();
}

function RemovablePanelInner(props: Record<string, any>) {
  // Solid does not null function refs on unmount, so clear the panel ref
  // explicitly to mirror a render function dropping the element.
  onCleanup(() => {
    props.ref?.(null);
  });

  return <div {...props} />;
}

function RemovablePanel(props: Record<string, any>) {
  const rootContext = useCollapsibleRootContext();

  return (
    <Show when={rootContext.open()}>
      <RemovablePanelInner {...props} />
    </Show>
  );
}

describe("<Collapsible.Panel />", () => {
  describeConformance(
    (props) => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Panel {...props} />
      </Collapsible.Root>
    ),
    () => ({
      defaultElement: "div",
      refInstanceof: window.HTMLDivElement,
      stateAttributes: { [CollapsiblePanelDataAttributes.open]: "" },
    }),
  );

  it("does not render the panel while closed", () => {
    const { panel } = renderCollapsible();

    expect(panel()).not.toBeInTheDocument();
  });

  it("renders the panel when opened", async () => {
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible();

    await clickTrigger(user, trigger);

    expect(panel()).toBeVisible();
    expect(panel()).not.toHaveAttribute("hidden");
    expect(panel()).toHaveAttribute(CollapsiblePanelDataAttributes.open, "");
  });

  it("keeps the panel mounted with `keepMounted`", async () => {
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible({}, { keepMounted: true });

    expect(panel()).toHaveAttribute("hidden");
    expect(panel()).toHaveAttribute(CollapsiblePanelDataAttributes.closed, "");

    await clickTrigger(user, trigger);

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
    expect(trigger).toHaveAttribute("aria-controls", panelId);
  });

  it("keeps the panel in the DOM with `hiddenUntilFound` and reveals it on `beforematch`", async () => {
    const onOpenChange = vi.fn();
    const { container, trigger, panel } = renderCollapsible({ onOpenChange }, { hiddenUntilFound: true });

    expect(panel()).toHaveAttribute("hidden", "until-found");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    panel()!.dispatchEvent(new Event("beforematch"));
    flush();
    await nextFrames();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe("none");
    expect(panel()).not.toHaveAttribute("hidden");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(container.contains(panel())).toBe(true);
  });

  it("persists starting styles while a `hiddenUntilFound` panel stays closed", () => {
    const { panel } = renderCollapsible({}, { hiddenUntilFound: true });

    // Upstream `shouldPersistHiddenTransitionStyles`: the closed panel keeps its
    // collapsed starting styles so a find-in-page reveal never flashes at full
    // height before the open commits.
    expect(panel()).toHaveAttribute("hidden", "until-found");
    expect(panel()).toHaveAttribute(CollapsiblePanelDataAttributes.startingStyle, "");
  });

  it("drops the persisted starting styles once the panel opens", async () => {
    const user = userEvent.setup();
    const { trigger, panel } = renderCollapsible({}, { hiddenUntilFound: true });

    expect(panel()).toHaveAttribute(CollapsiblePanelDataAttributes.startingStyle, "");

    await clickTrigger(user, trigger);

    expect(panel()).toHaveAttribute(CollapsiblePanelDataAttributes.open, "");
    await vi.waitFor(() => {
      expect(panel()).not.toHaveAttribute(CollapsiblePanelDataAttributes.startingStyle);
    });
  });

  it("supports canceling the `beforematch` open change", () => {
    const onOpenChange = vi.fn((_open: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });
    const { panel } = renderCollapsible({ onOpenChange }, { hiddenUntilFound: true });

    panel()!.dispatchEvent(new Event("beforematch"));
    flush();

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
    flush();

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
    flush();

    await vi.waitFor(() => {
      expect(panel()).toHaveAttribute("hidden", "until-found");
    });
    expect(panel()).toHaveAttribute(CollapsiblePanelDataAttributes.startingStyle, "");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("cancels a scheduled reveal revert when the panel unmounts", async () => {
    const onOpenChange = vi.fn((_open: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });
    const { unmount } = render(() => (
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel hiddenUntilFound>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const panel = screen.getByText("Content");

    panel.dispatchEvent(new Event("beforematch"));
    panel.removeAttribute("hidden");
    unmount();
    flush();
    await nextFrames();

    // The scheduled timeout and frame were cleared; nothing touches the detached panel.
    expect(panel.hasAttribute("hidden")).toBe(false);
  });

  it("finishes closing when the render function removes the panel element", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root defaultOpen onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel as={RemovablePanel}>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const trigger = screen.getByRole("button", { name: "Trigger" });

    expect(screen.getByText("Content")).toHaveAttribute("data-open");

    await user.click(trigger);
    flush();
    await nextFrames();
    await nextFrames();

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Content")).toBe(null);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    // Closing settles even though no element is left to animate.
    expect(trigger).not.toHaveAttribute("data-ending-style");
  });

  it("animates on reopen after an initially open panel is removed by the render function", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel as={RemovablePanel}>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const trigger = screen.getByRole("button", { name: "Trigger" });

    // The initial mount animation is suppressed while the panel starts open.
    // jsdom cannot run real CSS animations, so the test observes the inline
    // suppression style directly instead of the running animation.
    expect(screen.getByText("Content").style.getPropertyValue("animation-name")).toBe("none");

    await user.click(trigger);
    flush();
    await nextFrames();
    await nextFrames();

    expect(screen.queryByText("Content")).toBe(null);

    await user.click(trigger);
    flush();
    await nextFrames();

    const panel = screen.getByText("Content");

    expect(panel).toHaveAttribute("data-open");
    // The next open animates normally: no mount-animation suppression is left.
    expect(panel.style.getPropertyValue("animation-name")).toBe("");
  });

  // Upstream #5891 runs this against real CSS animations; jsdom cannot run
  // them, so the stronger assertions below only execute in browser mode while
  // the inline-style test above covers the same path in jsdom.
  it.skipIf(isJSDOM)("runs a real animation on reopen after an initially open panel is removed by the render function", async () => {
    const user = userEvent.setup();
    render(() => (
      <>
        <style>{`
          @keyframes removable-panel-open {
            from {
              opacity: 0;
            }

            to {
              opacity: 1;
            }
          }

          .removable-animation-panel[data-open] {
            animation: removable-panel-open 10s linear;
          }
        `}</style>

        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel as={RemovablePanel} class="removable-animation-panel" data-testid="panel">
            Content
          </Collapsible.Panel>
        </Collapsible.Root>
      </>
    ));

    const trigger = screen.getByRole("button", { name: "Trigger" });

    // The initial mount animation is suppressed while the panel starts open.
    expect(screen.getByTestId("panel").getAnimations()).toHaveLength(0);

    await user.click(trigger);
    flush();
    await nextFrames();
    await nextFrames();

    expect(screen.queryByTestId("panel")).toBe(null);

    await user.click(trigger);
    flush();
    await nextFrames();

    const panel = screen.getByTestId("panel");

    expect(panel).toHaveAttribute("data-open");
    await vi.waitFor(() => {
      expect(panel.getAnimations()).toHaveLength(1);
    });
    expect(getComputedStyle(panel).animationName).toBe("removable-panel-open");
  });
});
