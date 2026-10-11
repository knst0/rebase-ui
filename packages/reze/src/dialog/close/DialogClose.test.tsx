import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Dialog from "../index.parts";

afterEach(cleanup);

function renderDialog(options?: { onOpenChange?: (...args: any[]) => void; closeProps?: Record<string, unknown> }) {
  mount(() => (
    <Dialog.Root onOpenChange={options?.onOpenChange}>
      <Dialog.Trigger>Open dialog</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup data-testid="popup">
          <Dialog.Title>Dialog title</Dialog.Title>
          <Dialog.Close {...(options?.closeProps as object)}>Close dialog</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ));
}

async function openDialog() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open dialog" }));
  tick();
  await nextFrames();
  return user;
}

describe("<Dialog.Close />", () => {
  it("closes the dialog with the close-press reason", async () => {
    const handleOpenChange = vi.fn();
    renderDialog({ onOpenChange: handleOpenChange });
    const user = await openDialog();

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    tick();
    await nextFrames();

    expect(handleOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "close-press" }));
    expect(screen.queryByTestId("popup")).toBeNull();
  });

  it("lets a custom onClick replace the close logic", async () => {
    const handleClick = vi.fn();
    renderDialog({ closeProps: { onClick: handleClick } });
    const user = await openDialog();

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    tick();
    await nextFrames();

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("popup")).toBeInTheDocument();
  });

  it("does not close when disabled", async () => {
    renderDialog({ closeProps: { disabled: true } });
    const user = await openDialog();

    const close = screen.getByRole("button", { name: "Close dialog" });
    expect(close).toHaveAttribute("data-disabled");
    await user.click(close);
    tick();
    await nextFrames();

    expect(screen.queryByTestId("popup")).toBeInTheDocument();
  });
});
