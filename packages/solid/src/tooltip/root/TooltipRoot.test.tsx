import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { nextFrames } from "#test-utils";

import * as Tooltip from "../index.parts";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function renderTooltip(options?: { rootProps?: Record<string, any>; triggerProps?: Record<string, any>; popupChildren?: string }) {
  const { rootProps = {}, triggerProps = {}, popupChildren = "Tooltip content" } = options ?? {};
  render(() => (
    <Tooltip.Root {...rootProps}>
      <Tooltip.Trigger delay={0} {...triggerProps}>
        Hover me
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>{popupChildren}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  ));

  return {
    trigger: screen.getByRole("button", { name: "Hover me" }),
    popup: () => screen.queryByText(popupChildren),
  };
}

describe("<Tooltip.Root />", () => {
  it("opens on hover and closes on mouse leave", async () => {
    const { trigger, popup } = renderTooltip();
    expect(popup()).toBeNull();

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();

    fireEvent.mouseLeave(trigger, { relatedTarget: document.body });
    await sleep(10);
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
  });

  it("reports open changes with the trigger-hover reason", async () => {
    const onOpenChange = vi.fn();
    const { trigger } = renderTooltip({ rootProps: { onOpenChange } });

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe("trigger-hover");
  });

  it("closes on Escape with the escape-key reason", async () => {
    const onOpenChange = vi.fn();
    const { trigger, popup } = renderTooltip({ rootProps: { onOpenChange } });

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
    const lastCall = onOpenChange.mock.calls[onOpenChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe(false);
    expect(lastCall[1].reason).toBe("escape-key");
  });

  it("supports controlled open state", async () => {
    const { popup } = renderTooltip({ rootProps: { open: true } });
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
  });

  it("does not open on hover when disabled", async () => {
    const { trigger, popup } = renderTooltip({ rootProps: { disabled: true } });

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();

    expect(popup()).toBeNull();
  });

  it("opens on focus and marks the trigger open", async () => {
    const { trigger, popup } = renderTooltip();

    fireEvent.focus(trigger);
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(trigger).toHaveAttribute("data-popup-open");
  });

  it("renders trigger payloads through function children", async () => {
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

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Hover me" }));
    await sleep(10);
    flush();
    await nextFrames();

    expect(screen.getByText("Payload: Trigger payload")).toBeInTheDocument();
  });

  it("notifies when open animations complete", async () => {
    const onOpenChangeComplete = vi.fn();
    const { trigger, popup } = renderTooltip({ rootProps: { onOpenChangeComplete } });

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
  });
});
