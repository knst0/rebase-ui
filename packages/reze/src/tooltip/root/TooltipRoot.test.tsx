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

function renderTooltip(options?: { rootProps?: Record<string, any>; triggerProps?: Record<string, any>; popupChildren?: string }) {
  const { rootProps = {}, triggerProps = {}, popupChildren = "Tooltip content" } = options ?? {};
  mount(() => (
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
  tick();

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
    tick();
    await nextFrames();

    expect(popup()).toBeInTheDocument();

    fireEvent.mouseLeave(trigger, { relatedTarget: document.body });
    await sleep(10);
    tick();
    await nextFrames();

    expect(popup()).toBeNull();
  });

  it("reports open changes with the trigger-hover reason", async () => {
    const onOpenChange = vi.fn();
    const { trigger } = renderTooltip({ rootProps: { onOpenChange } });

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    tick();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe("trigger-hover");
  });

  it("closes on Escape with the escape-key reason", async () => {
    const onOpenChange = vi.fn();
    const { trigger, popup } = renderTooltip({ rootProps: { onOpenChange } });

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    tick();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    tick();
    await nextFrames();

    expect(popup()).toBeNull();
    const lastCall = onOpenChange.mock.calls[onOpenChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe(false);
    expect(lastCall[1].reason).toBe("escape-key");
  });

  it("supports controlled open state", async () => {
    const { popup } = renderTooltip({ rootProps: { open: true } });
    tick();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
  });

  it("does not open on hover when disabled", async () => {
    const { trigger, popup } = renderTooltip({ rootProps: { disabled: true } });

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    tick();

    expect(popup()).toBeNull();
  });

  it("opens on focus and marks the trigger open", async () => {
    const { trigger, popup } = renderTooltip();

    trigger.focus();
    tick();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(trigger).toHaveAttribute("data-popup-open");
  });

  it("renders trigger payloads through function children", async () => {
    mount(() => (
      <Tooltip.Root>
        {(root: { payload: string | undefined }) => (
          <>
            <Tooltip.Trigger delay={0} payload="Trigger payload">
              Hover me
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>
                  <span>Payload: {root.payload}</span>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </>
        )}
      </Tooltip.Root>
    ));
    tick();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Hover me" }));
    await sleep(10);
    tick();
    await nextFrames();

    expect(screen.getByText("Payload: Trigger payload")).toBeInTheDocument();
  });

  it("notifies when open animations complete", async () => {
    const onOpenChangeComplete = vi.fn();
    const { trigger, popup } = renderTooltip({ rootProps: { onOpenChangeComplete } });

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    tick();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
  });
});
