import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Tooltip from "../index.parts";

describe("<Tooltip.Arrow />", () => {
  it("renders hidden from assistive technology and follows the positioned side", async () => {
    render(() => (
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
    flush();
    await nextFrames();
    await nextFrames();

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
    expect(arrow.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
  });
});
