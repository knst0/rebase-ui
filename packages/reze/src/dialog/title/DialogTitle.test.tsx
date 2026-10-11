import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Dialog from "../index.parts";

afterEach(cleanup);

describe("<Dialog.Title />", () => {
  it("labels the popup through aria-labelledby", async () => {
    mount(() => (
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

    const title = screen.getByText("Dialog title");
    expect(title.tagName).toBe("H2");
    expect(screen.getByTestId("popup")).toHaveAttribute("aria-labelledby", title.id);
  });

  it("supports a custom id", async () => {
    mount(() => (
      <Dialog.Root>
        <Dialog.Trigger>Open dialog</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title id="custom-title">Dialog title</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    tick();
    await nextFrames();

    expect(screen.getByTestId("popup")).toHaveAttribute("aria-labelledby", "custom-title");
  });
});
