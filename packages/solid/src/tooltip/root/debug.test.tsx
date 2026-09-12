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

describe("debug", () => {
  it("logs state on hover/leave", async () => {
    let rootStore: any;
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
            <Probe
              onStore={(s) => {
                rootStore = s;
              }}
            />
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
    console.log(
      "AFTER ENTER",
      JSON.stringify({
        open: rootStore?.peekState?.()?.open,
        mounted: rootStore?.peekState?.()?.mounted,
        activeTriggerId: rootStore?.peekState?.()?.activeTriggerId,
        payload: rootStore?.peekState?.()?.payload,
        domRef: rootStore?.peekState?.()?.floatingRootContext?.peek?.("domReferenceElement")?.tagName ?? "n/a",
        floating: rootStore?.peekState?.()?.floatingRootContext?.peek?.("floatingElement")?.tagName ?? "n/a",
        placement: rootStore?.peekState?.()?.floatingRootContext?.peek?.("placement") ?? "n/a",
      }),
      document.body.innerHTML.slice(0, 600),
    );

    fireEvent.mouseLeave(trigger, { relatedTarget: document.body });
    await sleep(10);
    flush();
    await nextFrames();
    // eslint-disable-next-line no-console
    console.log(
      "AFTER LEAVE",
      JSON.stringify({
        open: rootStore?.peekState?.()?.open,
        mounted: rootStore?.peekState?.()?.mounted,
        activeTriggerId: rootStore?.peekState?.()?.activeTriggerId,
        payload: rootStore?.peekState?.()?.payload,
      }),
      document.body.innerHTML.slice(0, 600),
    );
    expect(true).toBe(true);
  });
});

import { useTooltipRootContext } from "./TooltipRootContext";

function Probe(props: { onStore: (s: any) => void }) {
  const store = useTooltipRootContext();
  props.onStore(store);
  return null;
}
