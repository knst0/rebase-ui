import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Popover from "../index.parts";

afterEach(cleanup);

function renderPopover(options?: { rootProps?: Record<string, any>; triggerProps?: Record<string, any>; popupChildren?: string }) {
  const { rootProps = {}, triggerProps = {}, popupChildren = "Popover content" } = options ?? {};
  mount(() => (
    <Popover.Root {...(rootProps as any)}>
      <Popover.Trigger {...(triggerProps as any)}>Open popover</Popover.Trigger>
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

    const user = userEvent.setup();
    await user.click(trigger);
    tick();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    await user.click(trigger);
    tick();
    await nextFrames();
    expect(popup()).toBeNull();
  });

  it("reports open changes with the trigger-press reason", async () => {
    const onOpenChange = vi.fn();
    const { trigger } = renderPopover({ rootProps: { onOpenChange } });

    const user = userEvent.setup();
    await user.click(trigger);
    tick();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe("trigger-press");
  });

  it("closes on Escape with the escape-key reason", async () => {
    const onOpenChange = vi.fn();
    const { trigger, popup } = renderPopover({ rootProps: { onOpenChange } });

    const user = userEvent.setup();
    await user.click(trigger);
    tick();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    await user.keyboard("{Escape}");
    tick();
    await nextFrames();

    expect(popup()).toBeNull();
    const lastCall = onOpenChange.mock.calls[onOpenChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe(false);
    expect(lastCall[1].reason).toBe("escape-key");
  });

  it("supports controlled open state", async () => {
    const { popup } = renderPopover({ rootProps: { open: true } });
    tick();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
  });

  it("marks the trigger open while its popover is open", async () => {
    const { trigger, popup } = renderPopover();

    const user = userEvent.setup();
    await user.click(trigger);
    tick();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(trigger).toHaveAttribute("data-popup-open");
    expect(trigger).toHaveAttribute("data-pressed");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("closes through Popover.Close with the close-press reason", async () => {
    const onOpenChange = vi.fn();
    mount(() => (
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

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open popover" }));
    tick();
    await nextFrames();
    expect(screen.queryByText("Content")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    tick();
    await nextFrames();

    expect(screen.queryByText("Content")).toBeNull();
    const lastCall = onOpenChange.mock.calls[onOpenChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe(false);
    expect(lastCall[1].reason).toBe("close-press");
  });

  it("renders focus guards around an open non-modal trigger", async () => {
    const { trigger } = renderPopover();

    const user = userEvent.setup();
    await user.click(trigger);
    tick();
    await nextFrames();

    expect(document.querySelectorAll("[data-base-ui-focus-guard]").length).toBe(2);
  });

  it("locks body scroll while a modal popover is open", async () => {
    const { trigger, popup } = renderPopover({ rootProps: { modal: true } });

    const user = userEvent.setup();
    await user.click(trigger);
    tick();
    await nextFrames();
    expect(popup()).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    tick();
    await nextFrames();
    expect(popup()).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("opens detached triggers through a handle", async () => {
    const handle = Popover.createHandle();
    mount(() => (
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
    tick();
    await nextFrames();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Detached" }));
    tick();
    await nextFrames();
    expect(screen.queryByText("Detached content")).toBeInTheDocument();
    expect(handle.isOpen).toBe(true);

    handle.close();
    tick();
    await nextFrames();
    expect(screen.queryByText("Detached content")).toBeNull();
  });

  it("renders trigger payloads through function children", async () => {
    mount(() => (
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

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open popover" }));
    tick();
    await nextFrames();

    expect(screen.getByText("Payload: Trigger payload")).toBeInTheDocument();
  });
});
