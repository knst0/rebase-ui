import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Dialog from "../index.parts";

afterEach(cleanup);

describe("<Dialog.Viewport />", () => {
  it("renders inside the portal while open", async () => {
    mount(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Viewport data-testid="viewport">
            <Dialog.Popup data-testid="popup">
              <Dialog.Title>Dialog title</Dialog.Title>
              <Dialog.Close>Close dialog</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    expect(screen.queryByTestId("viewport")).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    tick();
    await nextFrames();

    const viewport = screen.getByTestId("viewport");
    expect(viewport).toHaveAttribute("role", "presentation");
    expect(viewport).toHaveAttribute("data-open");
    expect(viewport.contains(screen.getByTestId("popup"))).toBe(true);

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    tick();
    await nextFrames();

    expect(screen.queryByTestId("viewport")).toBeNull();
  });

  it("stays hidden while closed with keepMounted", async () => {
    mount(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal keepMounted>
          <Dialog.Viewport data-testid="viewport">
            <Dialog.Popup data-testid="popup" keepMounted>
              <Dialog.Title>Dialog title</Dialog.Title>
              <Dialog.Close>Close dialog</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const viewport = screen.getByTestId("viewport");
    expect(viewport).toHaveAttribute("hidden");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    tick();
    await nextFrames();
    expect(screen.getByTestId("viewport")).not.toHaveAttribute("hidden");

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    tick();
    await nextFrames();
    expect(screen.getByTestId("viewport")).toHaveAttribute("hidden");
  });
});
