import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Select from "../../select/index.parts";
import * as Dialog from "../index.parts";
import * as DialogPopupDataAttributes from "../popup/DialogPopupDataAttributes";
import { createDialogHandle } from "../store/DialogHandle";

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

describe("<Dialog.Root />", () => {
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
    screen.getByRole("button", { name: "Open outer" }).focus();
    expect(screen.getByTestId("inner-popup")).toContainElement(document.activeElement as HTMLElement);
    await user.tab();
    expect(screen.getByRole("button", { name: "Close inner" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Close inner" })).toHaveFocus();

    await user.keyboard("{Escape}");
    flush();
    await nextFrames();

    expect(screen.queryByTestId("inner-popup")).toBeNull();
    expect(screen.queryByTestId("outer-popup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open inner" })).toHaveFocus();
  });

  describe("with a portaled Select inside the popup", () => {
    function renderDialogWithSelect(onOpenChange = vi.fn(), onValueChange = vi.fn()) {
      render(() => (
        <Dialog.Root onOpenChange={onOpenChange}>
          <Dialog.Trigger>Open dialog</Dialog.Trigger>
          <button type="button">Outside</button>
          <Dialog.Portal>
            <Dialog.Popup data-testid="popup">
              <Dialog.Title>Dialog title</Dialog.Title>
              <Select.Root defaultValue="apple" onValueChange={onValueChange}>
                <Select.Trigger data-testid="select-trigger">
                  <Select.Value />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner alignItemWithTrigger={false}>
                    <Select.Popup data-testid="select-popup">
                      <Select.Item value="apple">
                        <Select.ItemText>Apple</Select.ItemText>
                      </Select.Item>
                      <Select.Item value="banana">
                        <Select.ItemText>Banana</Select.ItemText>
                      </Select.Item>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      return { onOpenChange, onValueChange };
    }

    async function openDialogAndSelect() {
      const user = await openViaTrigger(screen.getByRole("button", { name: "Open dialog" }));
      await user.click(screen.getByTestId("select-trigger"));
      flush();
      await nextFrames();
      expect(screen.getByRole("option", { name: "Banana" })).toBeInTheDocument();
      return user;
    }

    it("keeps the dialog open when an option is chosen with the pointer, then closes on outside press", async () => {
      const { onOpenChange, onValueChange } = renderDialogWithSelect();
      const user = await openDialogAndSelect();

      await user.click(screen.getByRole("option", { name: "Banana" }));
      flush();
      await nextFrames();

      expect(onValueChange).toHaveBeenLastCalledWith("banana", expect.anything());
      expect(screen.getByTestId("select-trigger")).toHaveTextContent("banana");
      expect(screen.queryByTestId("popup")).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalledWith(false, expect.anything());

      await user.click(screen.getByRole("button", { name: "Outside" }));
      flush();
      await nextFrames();

      expect(screen.queryByTestId("popup")).toBeNull();
      expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "outside-press" }));
    });

    it("closes only the Select on Escape", async () => {
      const { onOpenChange } = renderDialogWithSelect();
      const user = await openDialogAndSelect();

      await user.keyboard("{Escape}");
      flush();
      await nextFrames();

      expect(screen.queryByRole("option", { name: "Banana" })).toBeNull();
      expect(screen.queryByTestId("popup")).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalledWith(false, expect.anything());

      await user.keyboard("{Escape}");
      flush();
      await nextFrames();

      expect(screen.queryByTestId("popup")).toBeNull();
      expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "escape-key" }));
    });
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
});
