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

describe("TooltipHandle", () => {
  it("opens, closes, and reports state for detached triggers", async () => {
    const handle = Tooltip.createHandle();

    render(() => (
      <>
        <Tooltip.Root handle={handle}>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Detached content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Tooltip.Trigger handle={handle} id="detached-trigger" delay={0}>
          Detached
        </Tooltip.Trigger>
      </>
    ));
    flush();
    await nextFrames();

    expect(handle.isOpen).toBe(false);

    handle.open("detached-trigger");
    flush();
    await nextFrames();

    expect(handle.isOpen).toBe(true);
    expect(screen.queryByText("Detached content")).toBeInTheDocument();

    handle.close();
    flush();
    await nextFrames();

    expect(handle.isOpen).toBe(false);
  });

  it("opens detached triggers on hover", async () => {
    const handle = Tooltip.createHandle();

    render(() => (
      <>
        <Tooltip.Root handle={handle}>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Hover content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Tooltip.Trigger handle={handle} id="hover-trigger" delay={0}>
          Hover detached
        </Tooltip.Trigger>
      </>
    ));
    flush();
    await nextFrames();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Hover detached" }));
    await sleep(10);
    flush();
    await nextFrames();

    expect(screen.queryByText("Hover content")).toBeInTheDocument();
  });

  it("switches payload across detached triggers through the viewport", async () => {
    const handle = Tooltip.createHandle<string>();

    render(() => (
      <Tooltip.Provider>
        <Tooltip.Trigger handle={handle} id="first" delay={0} payload="First payload">
          First
        </Tooltip.Trigger>
        <Tooltip.Trigger handle={handle} id="second" delay={0} payload="Second payload">
          Second
        </Tooltip.Trigger>
        <Tooltip.Root handle={handle}>
          {({ payload }) => (
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>
                  <Tooltip.Viewport>{payload}</Tooltip.Viewport>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
      </Tooltip.Provider>
    ));
    flush();
    await nextFrames();

    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });

    fireEvent.mouseEnter(first);
    await sleep(10);
    flush();
    await nextFrames();
    expect(screen.queryByText("First payload")).toBeInTheDocument();

    fireEvent.mouseLeave(first, { relatedTarget: second });
    fireEvent.mouseEnter(second);
    await sleep(10);
    flush();
    await nextFrames();
    expect(screen.queryByText("Second payload")).toBeInTheDocument();
  });

  it("throws when opening with an unknown trigger id", () => {
    const handle = Tooltip.createHandle();

    render(() => (
      <Tooltip.Root handle={handle}>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    flush();

    expect(() => handle.open("missing-trigger")).toThrow(
      'Rebase UI: TooltipHandle.open() was called with the trigger id "missing-trigger"',
    );
  });
});
