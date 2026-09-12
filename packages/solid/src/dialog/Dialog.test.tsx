import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { nextFrames } from "#test-utils";

import * as Dialog from "./index.parts";
import * as DialogPopupDataAttributes from "./popup/DialogPopupDataAttributes";
import { createDialogHandle } from "./store/DialogHandle";

function renderDialog(
  rootProps: Dialog.Root.Props = {},
  popupProps: Dialog.Popup.Props = {},
  options: { withViewport?: boolean; withBackdrop?: boolean } = {},
) {
  const { withViewport = true, withBackdrop = false } = options;

  render(() => (
    <Dialog.Root {...rootProps}>
      <Dialog.Trigger>Open dialog</Dialog.Trigger>
      <button type="button">Outside</button>
      <Dialog.Portal>
        {withBackdrop ? <Dialog.Backdrop data-testid="backdrop" /> : null}
        {withViewport ? (
          <Dialog.Viewport data-testid="viewport">
            <Dialog.Popup {...popupProps} data-testid="popup">
              <Dialog.Title>Dialog title</Dialog.Title>
              <Dialog.Description>Dialog description</Dialog.Description>
              <Dialog.Close>Close dialog</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Viewport>
        ) : (
          <Dialog.Popup {...popupProps} data-testid="popup">
            <Dialog.Title>Dialog title</Dialog.Title>
            <Dialog.Description>Dialog description</Dialog.Description>
            <Dialog.Close>Close dialog</Dialog.Close>
          </Dialog.Popup>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  ));

  return {
    trigger: screen.getByRole("button", { name: "Open dialog" }),
    outside: screen.getByRole("button", { name: "Outside" }),
    popup: () => screen.queryByTestId("popup"),
  };
}

async function openViaTrigger(trigger: HTMLElement) {
  const user = userEvent.setup();
  await user.click(trigger);
  flush();
  await nextFrames();
  return user;
}

describe("<Dialog />", () => {
  it("opens when the trigger is clicked and closes when the close button is clicked", async () => {
    const { trigger, popup } = renderDialog();

    expect(popup()).toBeNull();

    await openViaTrigger(trigger);

    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
  });

  it("reads no reactive values outside a tracking scope while opening and closing", async () => {
    const diagnostics: string[] = [];
    const originalWarn = console.warn;
    const originalError = console.error;
    const recordDiagnostic = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("STRICT_READ_UNTRACKED")) {
        diagnostics.push(args[0]);
      }
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      recordDiagnostic(...args);
      originalWarn(...args);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      recordDiagnostic(...args);
      originalError(...args);
    });

    try {
      const { trigger, popup } = renderDialog();

      await openViaTrigger(trigger);
      expect(popup()).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Close dialog" }));
      flush();
      await nextFrames();

      expect(popup()).toBeNull();
      expect(diagnostics).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("toggles open state when the trigger is clicked twice", async () => {
    const { trigger, popup } = renderDialog();
    const user = await openViaTrigger(trigger);

    expect(popup()).toBeInTheDocument();

    await user.click(trigger);
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    const { trigger, popup } = renderDialog({ onOpenChange });

    const user = await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    await user.keyboard("{Escape}");
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "escape-key" }));
  });

  it("closes on outside press", async () => {
    const onOpenChange = vi.fn();
    const { trigger, outside, popup } = renderDialog({ onOpenChange });

    await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(outside);
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "outside-press" }));
  });

  it("does not close on outside press when `disablePointerDismissal` is set", async () => {
    const onOpenChange = vi.fn();
    const { trigger, outside, popup } = renderDialog({ disablePointerDismissal: true, onOpenChange });

    await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(outside);
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false, expect.anything());
  });

  it("closes imperatively via `actionsRef`", async () => {
    const [actions, setActions] = createSignal<Dialog.Root.Actions | null>(null);
    const { trigger, popup } = renderDialog({ actionsRef: setActions });

    await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();
    expect(actions()).not.toBeNull();

    actions()?.close();
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
  });

  it("unmounts imperatively via `actionsRef.unmount` after a prevented unmount", async () => {
    const [actions, setActions] = createSignal<Dialog.Root.Actions | null>(null);
    const onOpenChange = vi.fn((open: boolean, eventDetails: Dialog.Root.ChangeEventDetails) => {
      if (!open) {
        eventDetails.preventUnmountOnClose();
      }
    });

    render(() => (
      <Dialog.Root onOpenChange={onOpenChange} actionsRef={setActions}>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal keepMounted>
          <Dialog.Popup data-testid="popup">
            <Dialog.Close>Close dialog</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const popup = () => screen.queryByTestId("popup");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    flush();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    flush();
    await nextFrames();

    // Still mounted because unmounting on close was prevented.
    expect(popup()).toBeInTheDocument();
    expect(popup()).toHaveAttribute("hidden");

    actions()?.unmount();
    flush();

    expect(popup()).toBeNull();
  });

  it("sets role, aria-modal, and title/description labelling", async () => {
    const { trigger, popup } = renderDialog();

    await openViaTrigger(trigger);

    const popupElement = popup()!;
    expect(popupElement).toHaveAttribute("role", "dialog");
    expect(popupElement).toHaveAttribute("aria-modal", "true");

    const labelledBy = popupElement.getAttribute("aria-labelledby");
    const describedBy = popupElement.getAttribute("aria-describedby");
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toHaveTextContent("Dialog title");
    expect(document.getElementById(describedBy!)).toHaveTextContent("Dialog description");

    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("traps focus and locks scroll while modal", async () => {
    const { trigger, popup } = renderDialog();

    await openViaTrigger(trigger);

    expect(popup()).toContainElement(document.activeElement as HTMLElement);
    expect(document.body.style.overflow).toBe("hidden");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    flush();
    await nextFrames();

    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("does not lock scroll for non-modal dialogs", async () => {
    const { trigger, popup } = renderDialog({ modal: false });

    await openViaTrigger(trigger);

    expect(popup()).toBeInTheDocument();
    expect(popup()).not.toHaveAttribute("aria-modal");
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("traps focus without locking scroll for `trap-focus` modals", async () => {
    const { trigger, popup } = renderDialog({ modal: "trap-focus" });

    await openViaTrigger(trigger);

    expect(popup()).toContainElement(document.activeElement as HTMLElement);
    expect(popup()).toHaveAttribute("aria-modal", "true");
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("supports controlled `open`", async () => {
    const onOpenChange = vi.fn();
    const { trigger, popup } = renderDialog({ open: true, onOpenChange });
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(trigger);
    flush();
    await nextFrames();

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "trigger-press" }));
    expect(popup()).toBeInTheDocument();
  });

  it("supports canceling via `eventDetails.cancel()`", async () => {
    const onOpenChange = vi.fn((_open: boolean, eventDetails: Dialog.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });
    const { trigger, popup } = renderDialog({ onOpenChange });

    const user = userEvent.setup();
    await user.click(trigger);
    flush();
    await nextFrames();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
  });

  it("keeps the popup mounted when unmounting on close is prevented", async () => {
    const onOpenChange = vi.fn((open: boolean, eventDetails: Dialog.Root.ChangeEventDetails) => {
      if (!open) {
        eventDetails.preventUnmountOnClose();
      }
    });

    render(() => (
      <Dialog.Root onOpenChange={onOpenChange}>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal keepMounted>
          <Dialog.Popup data-testid="popup">
            <Dialog.Close>Close dialog</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    flush();
    await nextFrames();

    expect(screen.queryByTestId("popup")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    flush();
    await nextFrames();

    const popupElement = screen.queryByTestId("popup");
    expect(popupElement).toBeInTheDocument();
    expect(popupElement).toHaveAttribute("hidden");
    expect(popupElement).toHaveAttribute(DialogPopupDataAttributes.closed, "");
  });

  it("supports nested dialogs where Escape closes only the topmost", async () => {
    render(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open outer</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Viewport>
            <Dialog.Popup data-testid="outer-popup">
              <Dialog.Title>Outer</Dialog.Title>
              <Dialog.Root>
                <Dialog.Trigger>Open inner</Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Popup data-testid="inner-popup">
                    <Dialog.Title>Inner</Dialog.Title>
                    <Dialog.Close>Close inner</Dialog.Close>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Open outer" }));
    flush();
    await nextFrames();
    expect(screen.queryByTestId("outer-popup")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open inner" }));
    flush();
    await nextFrames();
    expect(screen.queryByTestId("inner-popup")).toBeInTheDocument();
    expect(screen.queryByTestId("outer-popup")).toHaveAttribute(DialogPopupDataAttributes.nestedDialogOpen, "");

    await user.keyboard("{Escape}");
    flush();
    await nextFrames();

    expect(screen.queryByTestId("inner-popup")).toBeNull();
    expect(screen.queryByTestId("outer-popup")).toBeInTheDocument();
  });

  it("keeps the popup in the DOM with `keepMounted` and hides it when closed", async () => {
    render(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal keepMounted>
          <Dialog.Popup keepMounted data-testid="popup">
            <Dialog.Close>Close dialog</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const popup = () => screen.queryByTestId("popup");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(popup()).not.toHaveAttribute("hidden");

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(popup()).toHaveAttribute("hidden");
    expect(popup()).toHaveAttribute(DialogPopupDataAttributes.closed, "");
  });

  it("uses `hidden=until-found` when `hiddenUntilFound` is set", async () => {
    render(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal keepMounted>
          <Dialog.Popup hiddenUntilFound keepMounted data-testid="popup">
            <Dialog.Close>Close dialog</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const popup = () => screen.queryByTestId("popup");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    flush();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(popup()).toHaveAttribute("hidden", "until-found");
  });

  it("calls `onOpenChangeComplete` after open and close animations settle", async () => {
    const onOpenChangeComplete = vi.fn();
    const { trigger } = renderDialog({ onOpenChangeComplete });

    await openViaTrigger(trigger);
    expect(onOpenChangeComplete).toHaveBeenCalledWith(true);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    flush();
    await nextFrames();

    expect(onOpenChangeComplete).toHaveBeenCalledWith(false);
  });

  it("supports detached triggers via `handle`", async () => {
    const handle = createDialogHandle();

    render(() => (
      <>
        <Dialog.Trigger handle={handle}>Detached open</Dialog.Trigger>
        <Dialog.Root handle={handle}>
          <Dialog.Portal>
            <Dialog.Popup data-testid="popup">
              <Dialog.Title>Detached</Dialog.Title>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </>
    ));

    expect(handle.isOpen).toBe(false);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Detached open" }));
    flush();
    await nextFrames();

    expect(screen.queryByTestId("popup")).toBeInTheDocument();
    expect(handle.isOpen).toBe(true);

    handle.close();
    flush();
    await nextFrames();

    expect(screen.queryByTestId("popup")).toBeNull();
  });

  it("renders the backdrop with presentation role", async () => {
    const { trigger } = renderDialog({}, {}, { withBackdrop: true });

    await openViaTrigger(trigger);

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).toHaveAttribute("role", "presentation");
  });
});
