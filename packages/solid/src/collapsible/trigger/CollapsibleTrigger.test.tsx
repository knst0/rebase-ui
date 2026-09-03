import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { describeConformance } from "#test-utils";

import * as Collapsible from "../index.parts";
import * as CollapsibleTriggerDataAttributes from "./CollapsibleTriggerDataAttributes";

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
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const trigger = screen.getByRole("button");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");
    expect(trigger).not.toHaveAttribute(CollapsibleTriggerDataAttributes.panelOpen);

    await user.click(trigger);
    flush();

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute(CollapsibleTriggerDataAttributes.panelOpen, "");
    expect(trigger.getAttribute("aria-controls")).toBe(screen.getByText("Content").id);
  });

  it("does not render `aria-controls` when the panel is unmounted", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const trigger = screen.getByRole("button");
    const panelId = trigger.getAttribute("aria-controls");

    expect(panelId).toBeTruthy();

    await user.click(trigger);
    flush();

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");
  });

  it("uses a custom panel id for `aria-controls`", async () => {
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel id="custom-panel">Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    expect(screen.getByRole("button")).toHaveAttribute("aria-controls", "custom-panel");
  });

  it("keeps the panel id in the DOM without `aria-controls` when closed with `keepMounted`", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel id="kept-panel" keepMounted>
          Content
        </Collapsible.Panel>
      </Collapsible.Root>
    ));

    const trigger = screen.getByRole("button");
    await user.click(trigger);
    flush();

    expect(screen.getByText("Content")).toHaveAttribute("id", "kept-panel");
    expect(trigger).not.toHaveAttribute("aria-controls");
  });

  it("keeps the panel id in the DOM without `aria-controls` when closed with `hiddenUntilFound`", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel id="findable-panel" hiddenUntilFound>
          Content
        </Collapsible.Panel>
      </Collapsible.Root>
    ));

    const trigger = screen.getByRole("button");
    await user.click(trigger);
    flush();

    expect(screen.getByText("Content")).toHaveAttribute("id", "findable-panel");
    expect(trigger).not.toHaveAttribute("aria-controls");
  });

  it("reuses the same panel id after reopening", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const trigger = screen.getByRole("button");
    await user.click(trigger);
    flush();
    const panelId = trigger.getAttribute("aria-controls");

    await user.click(trigger);
    flush();
    await user.click(trigger);
    flush();

    expect(trigger).toHaveAttribute("aria-controls", panelId);
  });

  it("toggles on Enter and Space key presses", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel keepMounted>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const trigger = screen.getByRole("button");
    trigger.focus();

    await user.keyboard("{Enter}");
    flush();

    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard(" ");
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

    await user.click(trigger);
    flush();

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Content")).toHaveAttribute("hidden");
  });

  it("inherits `disabled` from the root", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root disabled>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel keepMounted>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const trigger = screen.getByRole("button");

    await user.click(trigger);
    flush();

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
