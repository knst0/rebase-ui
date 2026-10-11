import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Dialog from "../index.parts";

afterEach(cleanup);

function renderDialog(options?: { defaultOpen?: boolean; onOpenChange?: (...args: any[]) => void }) {
  mount(() => (
    <Dialog.Root defaultOpen={options?.defaultOpen} onOpenChange={options?.onOpenChange}>
      <Dialog.Trigger>Open dialog</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup data-testid="popup">
          <Dialog.Title>Dialog title</Dialog.Title>
          <Dialog.Close>Close dialog</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ));

  return {
    trigger: screen.getByRole("button", { name: "Open dialog" }),
    popup: () => screen.queryByTestId("popup"),
  };
}

describe("<Dialog.Root />", () => {
  it("is closed by default", () => {
    const { popup } = renderDialog();

    expect(popup()).toBeNull();
  });

  it("opens by default with defaultOpen", () => {
    const { popup } = renderDialog({ defaultOpen: true });

    expect(popup()).toBeInTheDocument();
  });

  it("reports trigger presses through onOpenChange", async () => {
    const handleOpenChange = vi.fn();
    const { trigger, popup } = renderDialog({ onOpenChange: handleOpenChange });

    const user = userEvent.setup();
    await user.click(trigger);
    tick();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: "trigger-press" }));
  });

  it("closes on Escape", async () => {
    const handleOpenChange = vi.fn();
    const { trigger, popup } = renderDialog({ onOpenChange: handleOpenChange });

    const user = userEvent.setup();
    await user.click(trigger);
    tick();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    await user.keyboard("{Escape}");
    tick();
    await nextFrames();

    expect(popup()).toBeNull();
    expect(handleOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "escape-key" }));
  });

  it("closes on outside presses", async () => {
    const handleOpenChange = vi.fn();
    const { trigger, popup } = renderDialog({ onOpenChange: handleOpenChange });

    const user = userEvent.setup();
    await user.click(trigger);
    tick();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    await user.click(document.body);
    tick();
    await nextFrames();

    expect(popup()).toBeNull();
    expect(handleOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "outside-press" }));
  });

  it("does not close on outside presses when disablePointerDismissal is set", async () => {
    mount(() => (
      <Dialog.Root disablePointerDismissal>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Dialog title</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    tick();
    await nextFrames();
    expect(screen.queryByTestId("popup")).toBeInTheDocument();

    await user.click(document.body);
    tick();
    await nextFrames();

    expect(screen.queryByTestId("popup")).toBeInTheDocument();
  });

  it("supports controlled open state", async () => {
    let open = signal(false);
    const handleOpenChange = vi.fn();
    mount(() => (
      <Dialog.Root
        open={open}
        onOpenChange={(nextOpen, eventDetails) => {
          handleOpenChange(nextOpen, eventDetails);
          open = nextOpen;
        }}
      >
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Dialog title</Dialog.Title>
            <Dialog.Close>Close dialog</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    tick();
    await nextFrames();
    expect(screen.queryByTestId("popup")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    tick();
    await nextFrames();

    expect(handleOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "close-press" }));
    expect(screen.queryByTestId("popup")).toBeNull();
  });

  it("keeps a controlled dialog open until the open prop changes", async () => {
    const handleOpenChange = vi.fn();
    mount(() => (
      <Dialog.Root open onOpenChange={handleOpenChange}>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Dialog title</Dialog.Title>
            <Dialog.Close>Close dialog</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    tick();
    await nextFrames();

    expect(handleOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "close-press" }));
    expect(screen.queryByTestId("popup")).toBeInTheDocument();
  });

  it("exposes close and unmount actions via actionsRef", async () => {
    let actions: Dialog.Root.Actions | null = null;
    mount(() => (
      <Dialog.Root
        defaultOpen
        actionsRef={(next) => {
          actions = next;
        }}
      >
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Dialog title</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    expect(actions).not.toBeNull();
    expect(screen.queryByTestId("popup")).toBeInTheDocument();

    actions!.close();
    tick();
    await nextFrames();

    expect(screen.queryByTestId("popup")).toBeNull();
  });

  it("opens and closes imperatively through a handle", async () => {
    const handle = Dialog.createHandle();
    const handleOpenChange = vi.fn();
    mount(() => (
      <Dialog.Root handle={handle} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Dialog title</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    expect(handle.isOpen).toBe(false);

    handle.open();
    tick();
    await nextFrames();

    expect(handle.isOpen).toBe(true);
    expect(screen.queryByTestId("popup")).toBeInTheDocument();
    expect(handleOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: "imperative-action" }));

    handle.close();
    tick();
    await nextFrames();

    expect(handle.isOpen).toBe(false);
    expect(screen.queryByTestId("popup")).toBeNull();
  });

  it("passes the trigger payload to render-prop children", async () => {
    mount(() => (
      <Dialog.Root>
        {({ payload }: { payload: string | undefined }) => (
          <>
            <Dialog.Trigger payload="from-trigger">Open dialog</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup data-testid="popup">
                <span data-testid="payload">{payload ?? "none"}</span>
              </Dialog.Popup>
            </Dialog.Portal>
          </>
        )}
      </Dialog.Root>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    tick();
    await nextFrames();

    expect(screen.getByTestId("payload")).toHaveTextContent("from-trigger");
  });

  it("closes only the topmost nested dialog on Escape", async () => {
    mount(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open outer</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup data-testid="outer-popup">
            <Dialog.Title>Outer title</Dialog.Title>
            <Dialog.Root>
              <Dialog.Trigger>Open inner</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Popup data-testid="inner-popup">
                  <Dialog.Title>Inner title</Dialog.Title>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open outer" }));
    tick();
    await nextFrames();
    await user.click(screen.getByRole("button", { name: "Open inner" }));
    tick();
    await nextFrames();

    expect(screen.queryByTestId("outer-popup")).toBeInTheDocument();
    expect(screen.queryByTestId("inner-popup")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    tick();
    await nextFrames();

    expect(screen.queryByTestId("inner-popup")).toBeNull();
    expect(screen.queryByTestId("outer-popup")).toBeInTheDocument();
  });

  it("does not set aria-modal on non-modal dialogs", async () => {
    mount(() => (
      <Dialog.Root modal={false}>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Dialog title</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    tick();
    await nextFrames();

    expect(screen.getByTestId("popup")).not.toHaveAttribute("aria-modal");
  });
});
