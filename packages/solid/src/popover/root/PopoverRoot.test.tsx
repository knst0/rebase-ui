import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { nextFrames } from "#test-utils";

import * as Popover from "../index.parts";

function renderPopover(options?: { rootProps?: Record<string, any>; triggerProps?: Record<string, any>; popupChildren?: string }) {
  const { rootProps = {}, triggerProps = {}, popupChildren = "Popover content" } = options ?? {};
  render(() => (
    <Popover.Root {...rootProps}>
      <Popover.Trigger {...triggerProps}>Open popover</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup>{popupChildren}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  ));

  return {
    trigger: screen.getByRole("button", { name: "Open popover" }),
    popup: () => screen.queryByText(popupChildren),
  };
}

describe("<Popover.Root />", () => {
  it("opens on trigger click and toggles closed on a second click", async () => {
    const { trigger, popup } = renderPopover();
    expect(popup()).toBeNull();

    fireEvent.click(trigger);
    flush();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    fireEvent.click(trigger);
    flush();
    await nextFrames();
    expect(popup()).toBeNull();
  });

  it("reports open changes with the trigger-press reason", async () => {
    const onOpenChange = vi.fn();
    const { trigger } = renderPopover({ rootProps: { onOpenChange } });

    fireEvent.click(trigger);
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe("trigger-press");
  });

  it("closes on Escape with the escape-key reason", async () => {
    const onOpenChange = vi.fn();
    const { trigger, popup } = renderPopover({ rootProps: { onOpenChange } });

    fireEvent.click(trigger);
    flush();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
    const lastCall = onOpenChange.mock.calls[onOpenChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe(false);
    expect(lastCall[1].reason).toBe("escape-key");
  });

  it("supports controlled open state", async () => {
    const { popup } = renderPopover({ rootProps: { open: true } });
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
  });

  it("marks the trigger open while its popover is open", async () => {
    const { trigger, popup } = renderPopover();

    fireEvent.click(trigger);
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(trigger).toHaveAttribute("data-popup-open");
    expect(trigger).toHaveAttribute("data-pressed");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("closes through Popover.Close with the close-press reason", async () => {
    const onOpenChange = vi.fn();
    render(() => (
      <Popover.Root onOpenChange={onOpenChange}>
        <Popover.Trigger>Open popover</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Close>Close</Popover.Close>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    fireEvent.click(screen.getByRole("button", { name: "Open popover" }));
    flush();
    await nextFrames();
    expect(screen.queryByText("Content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    flush();
    await nextFrames();

    expect(screen.queryByText("Content")).toBeNull();
    const lastCall = onOpenChange.mock.calls[onOpenChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe(false);
    expect(lastCall[1].reason).toBe("close-press");
  });

  it("renders focus guards around an open non-modal trigger", async () => {
    const { trigger } = renderPopover();

    fireEvent.click(trigger);
    flush();
    await nextFrames();

    expect(document.querySelectorAll("[data-base-ui-focus-guard]").length).toBe(2);
  });

  it("locks body scroll while a modal popover is open", async () => {
    const { trigger, popup } = renderPopover({ rootProps: { modal: true } });

    fireEvent.click(trigger);
    flush();
    await nextFrames();
    expect(popup()).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    flush();
    await nextFrames();
    expect(popup()).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("opens detached triggers through a handle", async () => {
    const handle = Popover.createHandle();
    render(() => (
      <>
        <Popover.Trigger handle={handle} id="detached-trigger">
          Detached
        </Popover.Trigger>
        <Popover.Root handle={handle}>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Detached content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </>
    ));
    flush();
    await nextFrames();

    fireEvent.click(screen.getByRole("button", { name: "Detached" }));
    flush();
    await nextFrames();
    expect(screen.queryByText("Detached content")).toBeInTheDocument();
    expect(handle.isOpen).toBe(true);

    handle.close();
    flush();
    await nextFrames();
    expect(screen.queryByText("Detached content")).toBeNull();
  });

  it("renders trigger payloads through function children", async () => {
    render(() => (
      <Popover.Root>
        {(root: { payload: string | undefined }) => (
          <>
            <Popover.Trigger payload="Trigger payload">Open popover</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>
                  <span>Payload: {root.payload}</span>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </>
        )}
      </Popover.Root>
    ));

    fireEvent.click(screen.getByRole("button", { name: "Open popover" }));
    flush();
    await nextFrames();

    expect(screen.getByText("Payload: Trigger payload")).toBeInTheDocument();
  });
});
