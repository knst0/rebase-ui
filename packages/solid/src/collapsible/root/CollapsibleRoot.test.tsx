import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { describeConformance } from "#test-utils";

import * as Collapsible from "../index.parts";
import * as CollapsibleRootDataAttributes from "./CollapsibleRootDataAttributes";

const nextFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flush();
        resolve();
      });
    });
  });

describe("<Collapsible.Root />", () => {
  describeConformance(
    (props) => <Collapsible.Root {...props} />,
    () => ({
      defaultElement: "div",
      refInstanceof: window.HTMLDivElement,
      stateAttributes: { [CollapsibleRootDataAttributes.closed]: "" },
    }),
  );

  it("renders closed by default", async () => {
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("renders open when `defaultOpen` is set", async () => {
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Content")).toBeVisible();
  });

  it("toggles the open state when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel keepMounted>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const root = screen.getByRole("button").parentElement!;

    expect(root).toHaveAttribute(CollapsibleRootDataAttributes.closed, "");

    await user.click(screen.getByRole("button"));
    flush();
    await nextFrames();

    expect(root).toHaveAttribute(CollapsibleRootDataAttributes.open, "");
    expect(screen.getByText("Content")).toBeVisible();

    await user.click(screen.getByRole("button"));
    flush();
    await nextFrames();

    expect(root).toHaveAttribute(CollapsibleRootDataAttributes.closed, "");
    expect(screen.getByText("Content")).toHaveAttribute("hidden");
  });

  it("calls `onOpenChange` with the `trigger-press` reason", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      </Collapsible.Root>
    ));

    await user.click(screen.getByRole("button"));
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe("trigger-press");

    await user.click(screen.getByRole("button"));
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange.mock.calls[1][0]).toBe(false);
  });

  it("supports canceling the change via `eventDetails.cancel()`", async () => {
    const onOpenChange = vi.fn((open: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel keepMounted>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    await user.click(screen.getByRole("button"));
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Content")).toHaveAttribute("hidden");
  });

  it("stays open in controlled mode when the trigger is clicked", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root open onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    await user.click(screen.getByRole("button"));
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
    expect(screen.getByText("Content")).toBeVisible();
  });

  it("ignores trigger clicks when disabled", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(() => (
      <Collapsible.Root disabled onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel keepMounted>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));

    const trigger = screen.getByRole("button");

    expect(trigger).toHaveAttribute(CollapsibleRootDataAttributes.disabled, "");

    await user.click(trigger);
    flush();

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("Content")).toHaveAttribute("hidden");
  });
});
