import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Tooltip from "../index.parts";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("<Tooltip.Provider />", () => {
  it("opens adjacent tooltips instantly once the group is active", async () => {
    render(() => (
      <Tooltip.Provider delay={30} timeout={1000}>
        <Tooltip.Root>
          <Tooltip.Trigger delay={30}>First</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>First content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger delay={30}>Second</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Second content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    ));
    flush();

    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });

    fireEvent.mouseEnter(first);
    fireEvent.mouseMove(first);
    await sleep(60);
    flush();
    await nextFrames();
    expect(screen.queryByText("First content")).toBeInTheDocument();

    // Moving directly onto the adjacent trigger opens its tooltip instantly,
    // well before the 30ms delay elapses.
    fireEvent.mouseEnter(second);
    fireEvent.mouseMove(second);
    await sleep(5);
    flush();
    expect(screen.queryByText("Second content")).toBeInTheDocument();
  });
});
