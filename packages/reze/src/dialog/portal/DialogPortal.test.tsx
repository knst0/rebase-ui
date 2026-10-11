import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Dialog from "../index.parts";

afterEach(cleanup);

describe("<Dialog.Portal />", () => {
  it("renders the popup into document.body by default", async () => {
    const { el } = mount(() => (
      <Dialog.Root>
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

    const popup = screen.getByTestId("popup");
    expect(popup).toBeInTheDocument();
    expect(el.contains(popup)).toBe(false);
    expect(popup.parentElement?.parentElement).toBe(document.body);
  });

  it("renders into a custom container", async () => {
    const container = document.createElement("div");
    container.setAttribute("data-testid", "container");
    document.body.appendChild(container);

    mount(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal container={container}>
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

    expect(container.contains(screen.getByTestId("popup"))).toBe(true);
  });

  it("keeps the portal wrapper mounted with keepMounted", async () => {
    mount(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal data-testid="portal" keepMounted>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title>Dialog title</Dialog.Title>
            <Dialog.Close>Close dialog</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    expect(screen.getByTestId("portal")).toBeInTheDocument();
    expect(screen.queryByTestId("popup")).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    tick();
    await nextFrames();
    expect(screen.getByTestId("popup")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    tick();
    await nextFrames();

    expect(screen.queryByTestId("popup")).toBeNull();
    expect(screen.getByTestId("portal")).toBeInTheDocument();
  });
});
