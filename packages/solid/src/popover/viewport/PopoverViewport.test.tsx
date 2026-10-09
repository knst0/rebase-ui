import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Popover from "../index.parts";

describe("<Popover.Viewport />", () => {
  it("keeps the popup mounted and snapshots the outgoing content when the trigger changes", async () => {
    const handle = Popover.createHandle<string>();

    render(() => (
      <>
        <Popover.Trigger handle={handle} id="first" payload="First payload">
          First
        </Popover.Trigger>
        <Popover.Trigger handle={handle} id="second" payload="Second payload">
          Second
        </Popover.Trigger>
        <Popover.Root handle={handle}>
          {(root) => (
            <Popover.Portal>
              <Popover.Positioner data-testid="positioner">
                <Popover.Popup data-testid="popup">
                  <Popover.Viewport data-testid="viewport">{root.payload}</Popover.Viewport>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          )}
        </Popover.Root>
      </>
    ));
    flush();
    await nextFrames();

    fireEvent.click(screen.getByRole("button", { name: "First" }));
    flush();
    await nextFrames();
    expect(screen.getByTestId("viewport").querySelector("[data-current]")).toHaveTextContent("First payload");

    const positionerBefore = screen.getByTestId("positioner");
    const popupBefore = screen.getByTestId("popup");
    const topBefore = positionerBefore.style.top;

    fireEvent.click(screen.getByRole("button", { name: "Second" }));
    flush();

    // The payload change must not recreate the popup subtree: a fresh positioner
    // would start unpositioned and animate in from the viewport origin, and a
    // fresh viewport would have no outgoing content to slide out.
    const viewport = screen.getByTestId("viewport");
    expect(screen.getByTestId("positioner")).toBe(positionerBefore);
    expect(screen.getByTestId("popup")).toBe(popupBefore);
    expect(positionerBefore.style.top).toBe(topBefore);
    expect(viewport.querySelector("[data-previous]")).not.toBeNull();
    expect(viewport.getAttribute("data-activation-direction")).not.toBeNull();

    await nextFrames();
    await nextFrames();
    expect(viewport.querySelector("[data-current]")).toHaveTextContent("Second payload");
  });
});
