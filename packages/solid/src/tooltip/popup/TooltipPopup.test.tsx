import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { nextFrames } from "#test-utils";

import * as Tooltip from "../index.parts";

describe("<Tooltip.Popup />", () => {
  it("renders its children when open", async () => {
    render(() => (
      <Tooltip.Root open>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    flush();
    await nextFrames();

    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("carries the open state attribute when open", async () => {
    render(() => (
      <Tooltip.Root open>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    flush();
    await nextFrames();

    expect(screen.getByTestId("popup")).toHaveAttribute("data-open");
  });

  it("throws a descriptive error when rendered outside <Tooltip.Positioner>", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <Tooltip.Root open>
            <Tooltip.Portal>
              <Tooltip.Popup />
            </Tooltip.Portal>
          </Tooltip.Root>
        )),
      ).toThrow("Rebase UI: TooltipPositionerContext is missing. TooltipPositioner parts must be placed within <Tooltip.Positioner>.");
    } finally {
      errorSpy.mockRestore();
    }
  });
});
