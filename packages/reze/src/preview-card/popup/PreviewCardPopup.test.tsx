import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
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

describe("<PreviewCard.Popup />", () => {
  it("marks the popup open with transition attributes", async () => {
    mount(() => (
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
    tick();

    dispatchMouseEnter(screen.getByRole("link", { name: "typography" }));
    await sleep(10);
    tick();
    await nextFrames();

    const popup = screen.getByTestId("popup");
    expect(popup).toHaveAttribute("data-open");
    expect(popup.getAttribute("tabindex")).toBe("-1");
  });

  it("renders a presentational backdrop that never intercepts pointer events", async () => {
    mount(() => (
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
    tick();

    expect(screen.getByTestId("backdrop")).toHaveAttribute("hidden");

    dispatchMouseEnter(screen.getByRole("link", { name: "typography" }));
    await sleep(10);
    tick();
    await nextFrames();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).not.toHaveAttribute("hidden");
    expect(backdrop).toHaveAttribute("data-open");
    expect(backdrop.getAttribute("role")).toBe("presentation");
    expect(backdrop.style.getPropertyValue("pointer-events")).toBe("none");
    expect(backdrop.style.getPropertyValue("user-select")).toBe("none");
  });
});
