import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Dialog from "../index.parts";

function renderDialog() {
  render(() => (
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
    flush();
    await nextFrames();

    const popupElement = popup()!;
    expect(popupElement).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", popupElement.id);
  });
});
