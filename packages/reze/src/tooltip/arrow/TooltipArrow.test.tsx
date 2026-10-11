import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Tooltip from "../index.parts";

afterEach(cleanup);

describe("<Tooltip.Arrow />", () => {
  it("renders hidden from assistive technology and follows the positioned side", async () => {
    mount(() => (
      <Tooltip.Root open>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>
              Content
              <Tooltip.Arrow data-testid="arrow" />
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    tick();
    await nextFrames();
    await nextFrames();

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
    expect(arrow.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
  });
});
