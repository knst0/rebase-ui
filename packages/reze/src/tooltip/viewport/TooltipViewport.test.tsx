import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Tooltip from "../index.parts";

afterEach(cleanup);

describe("<Tooltip.Viewport />", () => {
  it("wraps children in a current container", async () => {
    mount(() => (
      <Tooltip.Root open>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>
              <Tooltip.Viewport data-testid="viewport">Content</Tooltip.Viewport>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    tick();
    await nextFrames();

    const viewport = screen.getByTestId("viewport");
    expect(viewport.querySelector("[data-current]")).toHaveTextContent("Content");
  });
});
