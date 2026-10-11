import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

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

function renderCard() {
  mount(() => (
    <PreviewCard.Root>
      <PreviewCard.Trigger delay={0} closeDelay={0} href="https://example.com/typography">
        typography
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner data-testid="positioner" sideOffset={8}>
          <PreviewCard.Popup>
            Preview content
            <PreviewCard.Arrow data-testid="arrow" />
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  ));
  tick();

  return screen.getByRole("link", { name: "typography" });
}

describe("<PreviewCard.Positioner />", () => {
  it("positions the popup with kebab-case styles and reports side", async () => {
    const trigger = renderCard();

    dispatchMouseEnter(trigger);
    await sleep(10);
    tick();
    await nextFrames();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner.style.getPropertyValue("position")).toBe("absolute");
    expect(positioner.style.getPropertyValue("top")).toMatch(/px$/);
    expect(positioner.style.getPropertyValue("left")).toMatch(/px$/);
    expect(positioner.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
    expect(positioner).toHaveAttribute("data-open");
  });

  it("stays hidden until mounted", async () => {
    mount(() => (
      <PreviewCard.Root>
        <PreviewCard.Portal keepMounted>
          <PreviewCard.Positioner data-testid="positioner">
            <PreviewCard.Popup>Preview content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    tick();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toHaveAttribute("hidden");
  });

  it("repositions a retained popup after closing and reopening", async () => {
    let setOpen!: (value: boolean) => void;
    function Test() {
      let open = signal(true);
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
          <PreviewCard.Trigger href="https://example.com/typography">typography</PreviewCard.Trigger>
          <PreviewCard.Portal keepMounted>
            <PreviewCard.Positioner data-testid="positioner">
              <PreviewCard.Popup>Preview content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      );
    }
    mount(() => <Test />);
    tick();
    await nextFrames();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner).toBeVisible();
    expect(positioner.style.opacity).not.toBe("0");

    setOpen(false);
    tick();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toBe(positioner);
    expect(positioner).toHaveAttribute("hidden");

    setOpen(true);
    tick();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toBe(positioner);
    expect(positioner).not.toHaveAttribute("hidden");
    expect(positioner).toHaveAttribute("data-open");
    expect(positioner).toBeVisible();
    expect(positioner.style.opacity).not.toBe("0");
    expect(positioner.style.getPropertyValue("position")).toBe("absolute");
    expect(positioner.style.getPropertyValue("top")).toMatch(/px$/);
    expect(positioner.style.getPropertyValue("left")).toMatch(/px$/);
  });

  it("renders an arrow with positioning styles", async () => {
    const trigger = renderCard();

    dispatchMouseEnter(trigger);
    await sleep(10);
    tick();
    await nextFrames();
    await nextFrames();

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
    expect(arrow.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
  });
});
