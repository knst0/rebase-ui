import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Dialog from "../index.parts";

afterEach(cleanup);

function renderDialog() {
  mount(() => (
    <Dialog.Root>
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

describe("<Dialog.Trigger />", () => {
  it("reflects the popup relationship via aria-haspopup, aria-expanded, and aria-controls", async () => {
    const { trigger, popup } = renderDialog();

    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");

    const user = userEvent.setup();
    await user.click(trigger);
    tick();
    await nextFrames();

    const popupElement = popup()!;
    expect(popupElement).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", popupElement.id);
  });

  it("lets a custom onClick replace the trigger logic", async () => {
    const handleClick = vi.fn();
    mount(() => (
      <Dialog.Root>
        <Dialog.Trigger onClick={handleClick}>Open dialog</Dialog.Trigger>
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

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("popup")).toBeNull();
  });
});
