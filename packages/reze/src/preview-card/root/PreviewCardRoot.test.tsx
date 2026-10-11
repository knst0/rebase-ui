import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as PreviewCard from "../index.parts";

afterEach(cleanup);

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function dispatchMouseEnter(target: Element) {
  target.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: true }));
}

function renderCard(options?: { triggerProps?: Record<string, any>; rootProps?: Record<string, any> }) {
  const { triggerProps = {}, rootProps = {} } = options ?? {};
  mount(() => (
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
  tick();

  return screen.getByRole("link", { name: "typography" });
}

describe("<PreviewCard.Root />", () => {
  it("renders closed and opens when the trigger is hovered", async () => {
    const trigger = renderCard();

    expect(screen.queryByText("Preview content")).toBeNull();

    dispatchMouseEnter(trigger);
    await sleep(10);
    tick();

    expect(trigger).toHaveAttribute("data-popup-open");
    expect(screen.getByText("Preview content")).toBeVisible();
  });

  it("reports open changes with trigger details", async () => {
    const onOpenChange = vi.fn();
    const trigger = renderCard({ rootProps: { onOpenChange } });

    dispatchMouseEnter(trigger);
    await sleep(10);
    tick();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].trigger).toBe(trigger);
  });

  it("supports controlled open state", async () => {
    let setOpen!: (value: boolean) => void;
    function Test() {
      let open = signal(false);
      setOpen = (value: boolean) => {
        open = value;
      };
      return (
        <PreviewCard.Root
          open={open}
          onOpenChange={(next) => {
            open = next;
          }}
        >
          <PreviewCard.Trigger delay={0} closeDelay={0} href="https://example.com/typography" id="controlled-trigger">
            typography
          </PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>Preview content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      );
    }
    mount(() => <Test />);
    tick();

    expect(screen.queryByText("Preview content")).toBeNull();

    setOpen(true);
    tick();
    await nextFrames();

    expect(screen.getByText("Preview content")).toBeVisible();
  });

  it("closes imperatively through actionsRef", async () => {
    const actionsBox: { current: PreviewCard.Root.Actions | null } = { current: null };
    const trigger = renderCard({
      rootProps: {
        actionsRef: (next: PreviewCard.Root.Actions | null) => {
          actionsBox.current = next;
        },
      },
    });
    tick();

    dispatchMouseEnter(trigger);
    await sleep(10);
    tick();
    expect(screen.getByText("Preview content")).toBeVisible();

    actionsBox.current?.close();
    tick();
    await nextFrames();

    expect(screen.queryByText("Preview content")).toBeNull();
  });

  it("opens detached triggers by handle and renders their payload", async () => {
    const handle = PreviewCard.createHandle<{ title: string }>();
    mount(() => (
      <div>
        <PreviewCard.Trigger handle={handle} delay={0} closeDelay={0} href="https://example.com/a" payload={{ title: "Trigger A" }}>
          Link A
        </PreviewCard.Trigger>
        <PreviewCard.Root handle={handle}>
          {(root) => (
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup>{root.payload !== undefined && <span>Opened by {root.payload.title}</span>}</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          )}
        </PreviewCard.Root>
      </div>
    ));
    tick();

    dispatchMouseEnter(screen.getByRole("link", { name: "Link A" }));
    await sleep(10);
    tick();

    expect(screen.getByText("Opened by Trigger A")).toBeVisible();
    expect(handle.isOpen).toBe(true);

    handle.close();
    tick();
    await nextFrames();

    await vi.waitFor(() => expect(handle.isOpen).toBe(false));
  });
});
