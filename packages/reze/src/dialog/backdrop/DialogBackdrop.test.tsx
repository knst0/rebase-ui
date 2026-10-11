import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Dialog from "../index.parts";

afterEach(cleanup);

function renderDialog(backdropProps?: Record<string, unknown>) {
  mount(() => (
    <Dialog.Root>
      <Dialog.Trigger>Open dialog</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop data-testid="backdrop" {...(backdropProps as object)} />
        <Dialog.Popup data-testid="popup">
          <Dialog.Title>Dialog title</Dialog.Title>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ));
}

describe("<Dialog.Backdrop />", () => {
  it("is hidden until the dialog opens", async () => {
    renderDialog();

    expect(screen.queryByTestId("backdrop")).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    tick();
    await nextFrames();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).not.toHaveAttribute("hidden");
    expect(backdrop).toHaveAttribute("role", "presentation");
    expect(backdrop).toHaveAttribute("data-open");
  });

  it("is not rendered for nested dialogs unless forceRender is set", async () => {
    mount(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open outer</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop data-testid="outer-backdrop" />
          <Dialog.Popup data-testid="outer-popup">
            <Dialog.Title>Outer title</Dialog.Title>
            <Dialog.Root>
              <Dialog.Trigger>Open inner</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop data-testid="inner-backdrop" />
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

    expect(screen.getByTestId("outer-backdrop")).toBeInTheDocument();
    expect(screen.queryByTestId("inner-backdrop")).toBeNull();
  });

  it("renders for nested dialogs with forceRender", async () => {
    mount(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open outer</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup data-testid="outer-popup">
            <Dialog.Title>Outer title</Dialog.Title>
            <Dialog.Root>
              <Dialog.Trigger>Open inner</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop data-testid="inner-backdrop" forceRender />
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

    expect(screen.getByTestId("inner-backdrop")).toBeInTheDocument();
  });
});
