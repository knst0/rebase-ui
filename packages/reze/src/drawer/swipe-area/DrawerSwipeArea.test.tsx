import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Drawer from "../index.parts";

afterEach(cleanup);

describe("<Drawer.SwipeArea />", () => {
  it("renders a presentation element with directional touch-action", async () => {
    mount(() => (
      <Drawer.Root defaultOpen>
        <Drawer.SwipeArea data-testid="swipe-area" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <Drawer.Title>Title</Drawer.Title>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    tick();
    await nextFrames();

    const swipeArea = screen.queryByTestId("swipe-area")!;
    expect(swipeArea).toHaveAttribute("role", "presentation");
    expect(swipeArea).toHaveAttribute("data-swipe-direction", "up");
    // The open direction defaults to the opposite of the root swipe direction (`down`).
    expect(swipeArea.style.getPropertyValue("touch-action")).toBe("pan-x");
  });

  it("marks itself disabled", () => {
    mount(() => (
      <Drawer.Root>
        <Drawer.SwipeArea data-testid="swipe-area" disabled />
      </Drawer.Root>
    ));

    expect(screen.queryByTestId("swipe-area")).toHaveAttribute("data-disabled", "");
  });
});
