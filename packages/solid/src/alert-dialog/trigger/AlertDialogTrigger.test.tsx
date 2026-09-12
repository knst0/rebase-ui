import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import { createAlertDialogHandle } from "../handle";
import * as AlertDialog from "../index.parts";

describe("<AlertDialog.Trigger />", () => {
  it("supports detached triggers via `handle`", async () => {
    const handle = createAlertDialogHandle();

    render(() => (
      <>
        <AlertDialog.Trigger handle={handle}>Detached open</AlertDialog.Trigger>
        <AlertDialog.Root handle={handle}>
          <AlertDialog.Portal>
            <AlertDialog.Popup data-testid="popup">
              <AlertDialog.Title>Detached</AlertDialog.Title>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </>
    ));

    expect(handle.isOpen).toBe(false);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Detached open" }));
    flush();
    await nextFrames();

    expect(screen.queryByTestId("popup")).toBeInTheDocument();
    expect(handle.isOpen).toBe(true);

    handle.close();
    flush();
    await nextFrames();

    expect(screen.queryByTestId("popup")).toBeNull();
  });
});
