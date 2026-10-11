import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Popover from "../index.parts";

afterEach(cleanup);

describe("<Popover.Viewport />", () => {
  it("keeps the popup mounted and snapshots the outgoing content when the trigger changes", async () => {
    const handle = Popover.createHandle<string>();

    mount(() => (
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
    tick();
    await nextFrames();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "First" }));
    tick();
    await nextFrames();
    expect(screen.getByTestId("viewport").querySelector("[data-current]")).toHaveTextContent("First payload");

    const positionerBefore = screen.getByTestId("positioner");
    const popupBefore = screen.getByTestId("popup");
    const topBefore = positionerBefore.style.top;

    // Dispatched synchronously (no awaits): the outgoing-content snapshot is cleared
    // on the next animation frame, and user.click's real-time awaits would let that
    // frame interleave before the assertions below run.
    const second = screen.getByRole("button", { name: "Second" });
    fire(second, "pointerdown");
    fire(second, "mousedown");
    fire(second, "click");
    tick();

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
