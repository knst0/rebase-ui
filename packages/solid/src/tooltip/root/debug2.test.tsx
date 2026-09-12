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

describe("debug2", () => {
  it("function children without probe", async () => {
    render(() => (
      <Tooltip.Root>
        {({ payload }: { payload: string | undefined }) => (
          <>
            <Tooltip.Trigger delay={0} payload="Trigger payload">
              Hover me
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>
                  <span>Payload: {payload}</span>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </>
        )}
      </Tooltip.Root>
    ));

    const trigger = screen.getByRole("button", { name: "Hover me" });
    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();
    await nextFrames();
    // eslint-disable-next-line no-console
    console.log("FN-BODY", document.body.innerHTML.slice(0, 800));
    expect(true).toBe(true);
  });

  it("plain children baseline", async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger delay={0}>Hover me</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Tooltip content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const trigger = screen.getByRole("button", { name: "Hover me" });
    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();
    await nextFrames();
    // eslint-disable-next-line no-console
    console.log("PLAIN-BODY", document.body.innerHTML.slice(0, 800));
    expect(true).toBe(true);
  });
});
