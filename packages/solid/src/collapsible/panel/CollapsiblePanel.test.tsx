import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { describeConformance, nextFrames } from "#test-utils";

import * as Collapsible from "../index.parts";
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
});
