import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Dialog from "../index.parts";

afterEach(cleanup);

function renderDialog(ui?: { popupProps?: Record<string, unknown>; withClose?: boolean }) {
  mount(() => (
    <Dialog.Root>
      <Dialog.Trigger>Open dialog</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup data-testid="popup" {...(ui?.popupProps as object)}>
          <Dialog.Title>Dialog title</Dialog.Title>
          <Dialog.Description>Dialog description</Dialog.Description>
          {ui?.withClose !== false && <Dialog.Close>Close dialog</Dialog.Close>}
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

describe("<Dialog.Popup />", () => {
  it("exposes dialog semantics and labelling", async () => {
    renderDialog();
    await openDialog();

    const popup = screen.getByTestId("popup");
    expect(popup).toHaveAttribute("role", "dialog");
    expect(popup).toHaveAttribute("aria-modal", "true");
    expect(popup).toHaveAttribute("tabindex", "-1");

    const title = screen.getByText("Dialog title");
    const description = screen.getByText("Dialog description");
    expect(popup).toHaveAttribute("aria-labelledby", title.id);
    expect(popup).toHaveAttribute("aria-describedby", description.id);
    expect(title.id).not.toBe("");
    expect(description.id).not.toBe("");
  });

  it("moves focus into the popup on open and back to the trigger on close", async () => {
    renderDialog();
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();

    const user = userEvent.setup();
    await user.click(trigger);
    tick();
    await nextFrames();

    const popup = screen.getByTestId("popup");
    expect(popup.contains(document.activeElement)).toBe(true);

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    tick();
    await nextFrames();

    expect(document.activeElement).toBe(trigger);
  });

  it("focuses the initialFocus element on open", async () => {
    let field!: HTMLInputElement;
    mount(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup" initialFocus={() => field}>
            <input
              ref={(element) => {
                field = element as HTMLInputElement;
              }}
              aria-label="Name"
            />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    await openDialog();

    expect(document.activeElement).toBe(field);
  });

  it("does not move focus on open when initialFocus is false", async () => {
    renderDialog({ popupProps: { initialFocus: false } });
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();

    await openDialog();

    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the popup mounted but hidden after close with keepMounted", async () => {
    renderDialog({ popupProps: { keepMounted: true } });
    const user = await openDialog();
    expect(screen.getByTestId("popup")).not.toHaveAttribute("hidden");

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    tick();
    await nextFrames();

    const popup = screen.getByTestId("popup");
    expect(popup).toBeInTheDocument();
    expect(popup).toHaveAttribute("hidden");
  });

  it("uses hidden=until-found with hiddenUntilFound", async () => {
    renderDialog({ popupProps: { keepMounted: true, hiddenUntilFound: true } });
    const user = await openDialog();

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    tick();
    await nextFrames();

    expect(screen.getByTestId("popup")).toHaveAttribute("hidden", "until-found");
  });

  it("reflects transitions through data attributes", async () => {
    renderDialog();
    const user = await openDialog();

    const popup = screen.getByTestId("popup");
    expect(popup).toHaveAttribute("data-open");

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    tick();

    // The closing popup reports data-closed while its exit transition settles.
    const closing = screen.queryByTestId("popup");
    if (closing !== null) {
      expect(closing).toHaveAttribute("data-closed");
    }
    await nextFrames();
    expect(screen.queryByTestId("popup")).toBeNull();
  });

  it("marks nested dialogs", async () => {
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

    expect(screen.getByTestId("outer-popup")).not.toHaveAttribute("data-nested");

    await user.click(screen.getByRole("button", { name: "Open inner" }));
    tick();
    await nextFrames();

    expect(screen.getByTestId("inner-popup")).toHaveAttribute("data-nested");
    expect(screen.getByTestId("outer-popup")).toHaveAttribute("data-nested-dialog-open");
  });
});
