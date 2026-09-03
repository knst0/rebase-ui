import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { describeConformance } from "#test-utils";

import * as Collapsible from "../index.parts";
import * as CollapsiblePanelDataAttributes from "./CollapsiblePanelDataAttributes";

const nextFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flush();
        resolve();
      });
    });
  });

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

  it("does not render the panel while closed", async () => {
    render(() => (
      <Collapsible.Root>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("renders the panel when opened", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    await user.click(screen.getByRole("button"));
    flush();
    await nextFrames();

    const panel = screen.getByText("Content");

    expect(panel).toBeVisible();
    expect(panel).not.toHaveAttribute("hidden");
    expect(panel).toHaveAttribute(CollapsiblePanelDataAttributes.open, "");
  });

  it("keeps the panel mounted with `keepMounted`", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel keepMounted>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const panel = screen.getByText("Content");

    expect(panel).toHaveAttribute("hidden");
    expect(panel).toHaveAttribute(CollapsiblePanelDataAttributes.closed, "");

    await user.click(screen.getByRole("button"));
    flush();
    await nextFrames();

    expect(panel).not.toHaveAttribute("hidden");
    expect(panel).toHaveAttribute(CollapsiblePanelDataAttributes.open, "");
  });

  it("sets the panel id and links it to the trigger", async () => {
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel id="custom-panel">Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    expect(screen.getByText("Content")).toHaveAttribute("id", "custom-panel");
    expect(screen.getByRole("button")).toHaveAttribute("aria-controls", "custom-panel");
  });

  it("renders a generated panel id by default", async () => {
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const panelId = screen.getByText("Content").id;

    expect(panelId).toBeTruthy();
    expect(screen.getByRole("button")).toHaveAttribute("aria-controls", panelId);
  });

  it("keeps the panel in the DOM with `hiddenUntilFound` and reveals it on `beforematch`", async () => {
    const onOpenChange = vi.fn();
    const { container } = render(() => (
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel hiddenUntilFound>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const panel = screen.getByText("Content");

    expect(panel).toHaveAttribute("hidden", "until-found");
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");

    panel.dispatchEvent(new Event("beforematch"));
    flush();
    await nextFrames();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe("none");
    expect(panel).not.toHaveAttribute("hidden");
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    expect(container.contains(panel)).toBe(true);
  });

  it("supports canceling the `beforematch` open change", async () => {
    const onOpenChange = vi.fn((_open: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });
    render(() => (
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel hiddenUntilFound>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const panel = screen.getByText("Content");

    panel.dispatchEvent(new Event("beforematch"));
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(panel).toHaveAttribute("hidden", "until-found");
  });
});
