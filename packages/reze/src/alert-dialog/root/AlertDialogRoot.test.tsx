import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as AlertDialog from "../index.parts";

afterEach(cleanup);

describe("<AlertDialog.Root />", () => {
  it("renders an alertdialog and reports trigger presses", async () => {
    const handleOpenChange = vi.fn();
    mount(() => (
      <AlertDialog.Root onOpenChange={handleOpenChange}>
        <AlertDialog.Trigger>Delete item</AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop />
          <AlertDialog.Popup data-testid="popup">
            <AlertDialog.Title>Confirm deletion</AlertDialog.Title>
            <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
            <AlertDialog.Close>Cancel</AlertDialog.Close>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete item" }));
    tick();
    await nextFrames();

    const popup = screen.getByTestId("popup");
    expect(popup).toHaveAttribute("role", "alertdialog");
    expect(popup).toHaveAttribute("aria-modal", "true");
    expect(popup).toHaveAttribute("aria-labelledby", screen.getByText("Confirm deletion").id);
    expect(popup).toHaveAttribute("aria-describedby", screen.getByText("This cannot be undone.").id);
    expect(handleOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: "trigger-press" }));

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    tick();
    await nextFrames();

    expect(handleOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "close-press" }));
    expect(screen.queryByTestId("popup")).toBeNull();
  });

  it("opens imperatively through an alert dialog handle", async () => {
    const handle = AlertDialog.createHandle();
    mount(() => (
      <AlertDialog.Root handle={handle}>
        <AlertDialog.Portal>
          <AlertDialog.Popup data-testid="popup">
            <AlertDialog.Title>Confirm deletion</AlertDialog.Title>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ));

    expect(handle.isOpen).toBe(false);

    handle.open();
    tick();
    await nextFrames();

    expect(handle.isOpen).toBe(true);
    expect(screen.getByTestId("popup")).toHaveAttribute("role", "alertdialog");

    handle.close();
    tick();
    await nextFrames();

    expect(handle.isOpen).toBe(false);
    expect(screen.queryByTestId("popup")).toBeNull();
  });
});
