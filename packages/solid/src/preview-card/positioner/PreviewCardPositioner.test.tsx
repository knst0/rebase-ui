import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as PreviewCard from "../index.parts";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function renderCard() {
  render(() => (
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
  flush();

  return screen.getByRole("link", { name: "typography" });
}

describe("<PreviewCard.Positioner />", () => {
  it("positions the popup with kebab-case styles and reports side", async () => {
    const trigger = renderCard();

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();
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
    render(() => (
      <PreviewCard.Root>
        <PreviewCard.Portal keepMounted>
          <PreviewCard.Positioner data-testid="positioner">
            <PreviewCard.Popup>Preview content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    flush();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toHaveAttribute("hidden");
  });

  it("repositions a retained popup after closing and reopening", async () => {
    const [open, setOpen] = createSignal(true);
    render(() => (
      <PreviewCard.Root open={open()} onOpenChange={setOpen}>
        <PreviewCard.Trigger href="https://example.com/typography">typography</PreviewCard.Trigger>
        <PreviewCard.Portal keepMounted>
          <PreviewCard.Positioner data-testid="positioner">
            <PreviewCard.Popup>Preview content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    flush();
    await nextFrames();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner).toBeVisible();
    expect(positioner.style.opacity).not.toBe("0");

    setOpen(false);
    flush();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toBe(positioner);
    expect(positioner).toHaveAttribute("hidden");

    setOpen(true);
    flush();
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

    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();
    await nextFrames();
    await nextFrames();

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
    expect(arrow.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
  });
});
