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

describe("<PreviewCard.Popup />", () => {
  it("marks the popup open with transition attributes", async () => {
    render(() => (
      <PreviewCard.Root>
        <PreviewCard.Trigger delay={0} closeDelay={0} href="https://example.com/typography">
          typography
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup data-testid="popup">Preview content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    flush();

    fireEvent.mouseEnter(screen.getByRole("link", { name: "typography" }));
    await sleep(10);
    flush();
    await nextFrames();

    const popup = screen.getByTestId("popup");
    expect(popup).toHaveAttribute("data-open");
    expect(popup.getAttribute("tabindex")).toBe("-1");
  });

  it("renders a presentational backdrop that never intercepts pointer events", async () => {
    render(() => (
      <PreviewCard.Root>
        <PreviewCard.Trigger delay={0} closeDelay={0} href="https://example.com/typography">
          typography
        </PreviewCard.Trigger>
        <PreviewCard.Backdrop data-testid="backdrop" />
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup>Preview content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    flush();

    expect(screen.getByTestId("backdrop")).toHaveAttribute("hidden");

    fireEvent.mouseEnter(screen.getByRole("link", { name: "typography" }));
    await sleep(10);
    flush();
    await nextFrames();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).not.toHaveAttribute("hidden");
    expect(backdrop).toHaveAttribute("data-open");
    expect(backdrop.getAttribute("role")).toBe("presentation");
    expect(backdrop.style.getPropertyValue("pointer-events")).toBe("none");
    expect(backdrop.style.getPropertyValue("user-select")).toBe("none");
  });
});
