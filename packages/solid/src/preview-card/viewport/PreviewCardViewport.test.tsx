import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as PreviewCard from "../index.parts";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("<PreviewCard.Viewport />", () => {
  it("keeps the popup mounted and snapshots the outgoing content when the trigger changes", async () => {
    const handle = PreviewCard.createHandle<string>();

    render(() => (
      <>
        <PreviewCard.Trigger handle={handle} id="first" delay={0} closeDelay={0} href="https://example.com/a" payload="First payload">
          Link A
        </PreviewCard.Trigger>
        <PreviewCard.Trigger handle={handle} id="second" delay={0} closeDelay={0} href="https://example.com/b" payload="Second payload">
          Link B
        </PreviewCard.Trigger>
        <PreviewCard.Root handle={handle}>
          {(root) => (
            <PreviewCard.Portal>
              <PreviewCard.Positioner data-testid="positioner">
                <PreviewCard.Popup data-testid="popup">
                  <PreviewCard.Viewport data-testid="viewport">{root.payload}</PreviewCard.Viewport>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          )}
        </PreviewCard.Root>
      </>
    ));
    flush();
    await nextFrames();

    fireEvent.mouseEnter(screen.getByRole("link", { name: "Link A" }));
    await sleep(10);
    flush();
    await nextFrames();
    expect(screen.getByTestId("viewport").querySelector("[data-current]")).toHaveTextContent("First payload");

    const positionerBefore = screen.getByTestId("positioner");
    const popupBefore = screen.getByTestId("popup");
    const topBefore = positionerBefore.style.top;

    handle.open("second");
    flush();

    // The payload change must not recreate the popup subtree: a fresh positioner
    // would start unpositioned and animate in from the viewport origin, and a
    // fresh viewport would have no outgoing content to slide out.
    const viewport = screen.getByTestId("viewport");
    expect(screen.getByTestId("positioner")).toBe(positionerBefore);
    expect(screen.getByTestId("popup")).toBe(popupBefore);
    expect(positionerBefore.style.top).toBe(topBefore);
    expect(viewport.querySelector("[data-previous]")).not.toBeNull();
    expect(viewport.getAttribute("data-activation-direction")).not.toBeNull();

    await sleep(10);
    flush();
    await nextFrames();
    await nextFrames();
    expect(viewport.querySelector("[data-current]")).toHaveTextContent("Second payload");
  });
});
