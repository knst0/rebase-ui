import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
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

  it("respects a trigger delay over delay=0 outside the instant phase", async () => {
    render(() => (
      <Tooltip.Provider delay={0} timeout={150}>
        <Tooltip.Root>
          <Tooltip.Trigger delay={60}>First</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>First content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger delay={60}>Second</Tooltip.Trigger>
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

    // The trigger delay wins over the zero provider delay outside the instant phase.
    fireEvent.mouseEnter(first);
    fireEvent.mouseMove(first);
    await sleep(40);
    flush();
    expect(screen.queryByText("First content")).not.toBeInTheDocument();

    await sleep(40);
    flush();
    await nextFrames();
    expect(screen.queryByText("First content")).toBeInTheDocument();

    // Moving onto the adjacent trigger opens its tooltip instantly.
    fireEvent.mouseLeave(first);
    fireEvent.mouseEnter(second);
    fireEvent.mouseMove(second);
    await sleep(5);
    flush();
    expect(screen.queryByText("Second content")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("First content")).not.toBeInTheDocument());

    // Once the group timeout elapses, the full trigger delay applies again.
    fireEvent.mouseLeave(second);
    await sleep(200);
    flush();

    fireEvent.mouseEnter(first);
    fireEvent.mouseMove(first);
    await sleep(40);
    flush();
    expect(screen.queryByText("First content")).not.toBeInTheDocument();

    await sleep(40);
    flush();
    await nextFrames();
    expect(screen.queryByText("First content")).toBeInTheDocument();
  });
});
