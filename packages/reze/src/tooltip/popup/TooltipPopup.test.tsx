import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Tooltip from "../index.parts";

afterEach(cleanup);

describe("<Tooltip.Popup />", () => {
  it("renders its children when open", async () => {
    mount(() => (
      <Tooltip.Root open>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    tick();
    await nextFrames();

    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("carries the open state attribute when open", async () => {
    mount(() => (
      <Tooltip.Root open>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    tick();
    await nextFrames();

    expect(screen.getByTestId("popup")).toHaveAttribute("data-open");
  });

  it("keeps the starting style when the popup mounts after the opening frame", async () => {
    let setIsOpen!: (value: boolean) => void;
    let setShowPopup!: (value: boolean) => void;
    function Test() {
      let isOpen = signal(false);
      let showPopup = signal(false);
      setIsOpen = (value: boolean) => {
        isOpen = value;
      };
      setShowPopup = (value: boolean) => {
        showPopup = value;
      };
      return (
        <Tooltip.Root open={isOpen}>
          <Tooltip.Portal>
            <Tooltip.Positioner data-testid="positioner">
              {showPopup && <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>}
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }
    mount(() => <Test />);
    tick();

    setIsOpen(true);
    tick();
    await nextFrames();
    await nextFrames();

    // The popup mounts late (e.g. deferred portal rendering): the enter
    // transition must still start from the starting style instead of snapping
    // in without an animation.
    setShowPopup(true);
    tick();
    expect(screen.getByTestId("popup")).toHaveAttribute("data-starting-style");

    await nextFrames();
    expect(screen.getByTestId("popup")).not.toHaveAttribute("data-starting-style");
  });
});
