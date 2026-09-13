import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { nextFrames } from "#test-utils";

import * as PreviewCard from "../index.parts";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function renderCard(options?: { triggerProps?: Record<string, any>; rootProps?: Record<string, any> }) {
  const { triggerProps = {}, rootProps = {} } = options ?? {};
  render(() => (
    <PreviewCard.Root {...rootProps}>
      <PreviewCard.Trigger delay={0} closeDelay={0} href="https://example.com/typography" {...triggerProps}>
        typography
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner sideOffset={8}>
          <PreviewCard.Popup>Preview content</PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  ));

  return screen.getByRole("link", { name: "typography" });
}

describe("<PreviewCard.Root />", () => {
  it("renders closed and opens when the trigger is hovered", async () => {
    const trigger = renderCard();

    expect(screen.queryByText("Preview content")).toBeNull();

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();

    expect(trigger).toHaveAttribute("data-popup-open");
    expect(screen.getByText("Preview content")).toBeVisible();
  });

  it("reports open changes with trigger details", async () => {
    const onOpenChange = vi.fn();
    const trigger = renderCard({ rootProps: { onOpenChange } });

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].trigger).toBe(trigger);
  });

  it("supports controlled open state", async () => {
    const [open, setOpen] = createSignal(false);
    render(() => (
      <PreviewCard.Root open={open()} onOpenChange={setOpen}>
        <PreviewCard.Trigger delay={0} closeDelay={0} href="https://example.com/typography" id="controlled-trigger">
          typography
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup>Preview content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    flush();

    expect(screen.queryByText("Preview content")).toBeNull();

    setOpen(true);
    flush();
    await nextFrames();

    expect(screen.getByText("Preview content")).toBeVisible();
  });

  it("closes imperatively through actionsRef", async () => {
    const [actions, setActions] = createSignal<PreviewCard.Root.Actions | null>(null);
    const trigger = renderCard({ rootProps: { actionsRef: setActions } });
    flush();

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();
    expect(screen.getByText("Preview content")).toBeVisible();

    actions()?.close();
    flush();
    await nextFrames();

    expect(screen.queryByText("Preview content")).toBeNull();
  });

  it("opens detached triggers by handle and renders their payload", async () => {
    const handle = PreviewCard.createHandle<{ title: string }>();
    render(() => (
      <div>
        <PreviewCard.Trigger handle={handle} delay={0} closeDelay={0} href="https://example.com/a" payload={{ title: "Trigger A" }}>
          Link A
        </PreviewCard.Trigger>
        <PreviewCard.Root handle={handle}>
          {({ payload }) => (
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup>{payload !== undefined && <span>Opened by {payload.title}</span>}</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          )}
        </PreviewCard.Root>
      </div>
    ));
    flush();

    fireEvent.mouseEnter(screen.getByRole("link", { name: "Link A" }));
    await sleep(10);
    flush();

    expect(screen.getByText("Opened by Trigger A")).toBeVisible();
    expect(handle.isOpen).toBe(true);

    handle.close();
    flush();
    await nextFrames();

    expect(handle.isOpen).toBe(false);
  });
});
