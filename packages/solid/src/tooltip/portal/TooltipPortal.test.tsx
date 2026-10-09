import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Tooltip from "../index.parts";

describe("<Tooltip.Portal />", () => {
  it("renders the popup into the document body", async () => {
    render(() => (
      <div data-testid="root-container">
        <Tooltip.Root open>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Portaled content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    ));
    flush();
    await nextFrames();

    const popup = screen.getByText("Portaled content");
    expect(popup).toBeInTheDocument();
    expect(screen.getByTestId("root-container").contains(popup)).toBe(false);
  });

  it("renders nothing when closed unless kept mounted", async () => {
    const { unmount } = render(() => (
      <Tooltip.Root>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Hidden content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    flush();

    expect(screen.queryByText("Hidden content")).toBeNull();
    unmount();
  });
});
