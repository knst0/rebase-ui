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
        <Dialog.Backdrop data-testid="backdrop" />
        <Dialog.Popup data-testid="popup">
          <Dialog.Close>Close dialog</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ));

  return {
    trigger: screen.getByRole("button", { name: "Open dialog" }),
  };
}

describe("<Dialog.Backdrop />", () => {
  it("renders the backdrop with presentation role", async () => {
    const { trigger } = renderDialog();

    const user = userEvent.setup();
    await user.click(trigger);
    flush();
    await nextFrames();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).toHaveAttribute("role", "presentation");
  });
});
