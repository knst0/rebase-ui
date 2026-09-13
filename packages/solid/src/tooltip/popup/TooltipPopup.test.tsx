import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { createSignal, flush, Show } from "solid-js";
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

  it("keeps the starting style when the popup mounts after the opening frame", async () => {
    const [isOpen, setIsOpen] = createSignal(false);
    const [showPopup, setShowPopup] = createSignal(false);

    render(() => (
      <Tooltip.Root open={isOpen()}>
        <Tooltip.Portal>
          <Tooltip.Positioner data-testid="positioner">
            <Show when={showPopup()}>
              <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
            </Show>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    flush();

    setIsOpen(true);
    flush();
    await nextFrames();
    await nextFrames();

    // The popup mounts late (e.g. deferred portal rendering): the enter
    // transition must still start from the starting style instead of snapping
    // in without an animation.
    setShowPopup(true);
    flush();
    expect(screen.getByTestId("popup")).toHaveAttribute("data-starting-style");

    await nextFrames();
    expect(screen.getByTestId("popup")).not.toHaveAttribute("data-starting-style");
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
