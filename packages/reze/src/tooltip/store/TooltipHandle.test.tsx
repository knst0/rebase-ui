import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { fireEvent, screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Tooltip from "../index.parts";

afterEach(cleanup);

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("TooltipHandle", () => {
  it("opens, closes, and reports state for detached triggers", async () => {
    const handle = Tooltip.createHandle();
    const onOpenChange = vi.fn();

    mount(() => (
      <>
        <Tooltip.Root handle={handle} onOpenChange={onOpenChange}>
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
    tick();
    await nextFrames();

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(handle.isOpen).toBe(false);

    handle.open("detached-trigger");
    tick();
    await nextFrames();

    expect(handle.isOpen).toBe(true);
    expect(screen.queryByText("Detached content")).toBeInTheDocument();

    handle.close();
    tick();
    await nextFrames();

    expect(handle.isOpen).toBe(false);
  });

  it("opens detached triggers on hover", async () => {
    const handle = Tooltip.createHandle();

    mount(() => (
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
    tick();
    await nextFrames();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Hover detached" }));
    await sleep(10);
    tick();
    await nextFrames();

    expect(screen.queryByText("Hover content")).toBeInTheDocument();
  });

  it("switches payload across detached triggers through the viewport", async () => {
    const handle = Tooltip.createHandle<string>();

    mount(() => (
      <Tooltip.Provider>
        <Tooltip.Trigger handle={handle} id="first" delay={0} payload="First payload">
          First
        </Tooltip.Trigger>
        <Tooltip.Trigger handle={handle} id="second" delay={0} payload="Second payload">
          Second
        </Tooltip.Trigger>
        <Tooltip.Root handle={handle}>
          {(root) => (
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>
                  <Tooltip.Viewport>{root.payload}</Tooltip.Viewport>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
      </Tooltip.Provider>
    ));
    tick();
    await nextFrames();

    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });

    fireEvent.mouseEnter(first);
    await sleep(10);
    tick();
    await nextFrames();
    expect(screen.queryByText("First payload")).toBeInTheDocument();

    fireEvent.mouseLeave(first, { relatedTarget: second });
    fireEvent.mouseEnter(second);
    await sleep(10);
    tick();
    await nextFrames();
    expect(screen.queryByText("Second payload")).toBeInTheDocument();
  });

  it("slides viewport content and keeps positioner coordinates when switching triggers", async () => {
    const handle = Tooltip.createHandle<string>();

    mount(() => (
      <Tooltip.Provider>
        <Tooltip.Trigger handle={handle} id="first" delay={0} payload="First payload">
          First
        </Tooltip.Trigger>
        <Tooltip.Trigger handle={handle} id="second" delay={0} payload="Second payload">
          Second
        </Tooltip.Trigger>
        <Tooltip.Root handle={handle}>
          {(root) => (
            <Tooltip.Portal>
              <Tooltip.Positioner data-testid="positioner">
                <Tooltip.Popup>
                  <Tooltip.Viewport data-testid="viewport">{root.payload}</Tooltip.Viewport>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
      </Tooltip.Provider>
    ));
    tick();
    await nextFrames();

    handle.open("first");
    await sleep(10);
    tick();
    await nextFrames();
    await nextFrames();
    expect(screen.queryByText("First payload")).toBeInTheDocument();

    const topBefore = screen.getByTestId("positioner").style.top;

    handle.open("second");
    tick();

    // The viewport keeps both contents for the directional slide instead of
    // dropping the previous content when the payload changes.
    const viewport = screen.getByTestId("viewport");
    expect(viewport.querySelector("[data-previous]")).not.toBeNull();
    expect(viewport.getAttribute("data-activation-direction")).not.toBeNull();
    // The positioner element survives the payload change, so it glides from the
    // committed coordinates instead of jumping to the viewport origin.
    expect(screen.getByTestId("positioner").style.top).toBe(topBefore);

    await sleep(10);
    tick();
    await nextFrames();
    await nextFrames();
    expect(screen.queryByText("Second payload")).toBeInTheDocument();
  });

  it("throws when opening with an unknown trigger id", () => {
    const handle = Tooltip.createHandle();

    mount(() => (
      <Tooltip.Root handle={handle}>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    tick();

    expect(() => handle.open("missing-trigger")).toThrow(
      'Rebase UI: TooltipHandle.open() was called with the trigger id "missing-trigger"',
    );
  });
});
