import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

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
