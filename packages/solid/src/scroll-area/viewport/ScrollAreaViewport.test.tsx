import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as ScrollArea from "../index.parts";
import * as ScrollAreaRootDataAttributes from "../root/ScrollAreaRootDataAttributes";
import * as ScrollAreaViewportCssVars from "./ScrollAreaViewportCssVars";

async function settle(rounds = 3) {
  for (let i = 0; i < rounds; i += 1) {
    flush();
    await nextFrames();
  }
  flush();
}

function mockViewportMetrics(
  element: HTMLElement,
  metrics: {
    scrollHeight: number;
    scrollWidth: number;
    clientHeight: number;
    clientWidth: number;
    scrollTop?: number;
    scrollLeft?: number;
  },
) {
  let scrollTop = metrics.scrollTop ?? 0;
  let scrollLeft = metrics.scrollLeft ?? 0;

  Object.defineProperties(element, {
    scrollHeight: { configurable: true, get: () => metrics.scrollHeight },
    scrollWidth: { configurable: true, get: () => metrics.scrollWidth },
    clientHeight: { configurable: true, get: () => metrics.clientHeight },
    clientWidth: { configurable: true, get: () => metrics.clientWidth },
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    },
    scrollLeft: {
      configurable: true,
      get: () => scrollLeft,
      set: (value: number) => {
        scrollLeft = value;
      },
    },
  });
}

function mockElementSize(element: HTMLElement, size: { offsetWidth?: number; offsetHeight?: number }) {
  Object.defineProperties(element, {
    offsetWidth: { configurable: true, get: () => size.offsetWidth ?? 0 },
    offsetHeight: { configurable: true, get: () => size.offsetHeight ?? 0 },
  });
}

function renderVerticalScrollArea() {
  render(() => (
    <ScrollArea.Root>
      <ScrollArea.Viewport data-testid="viewport">
        <ScrollArea.Content>content</ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar data-testid="scrollbar">
        <ScrollArea.Thumb data-testid="thumb" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  ));

  return {
    root: screen.getByTestId("viewport").parentElement as HTMLElement,
    viewport: screen.getByTestId("viewport") as HTMLElement,
  };
}

function scrollViewport(viewport: HTMLElement, top: number) {
  viewport.scrollTop = top;
  viewport.dispatchEvent(new Event("scroll", { bubbles: false, cancelable: false }));
}

describe("<ScrollArea.Viewport />", () => {
  it("stays out of tab order without overflow and becomes focusable with overflow", async () => {
    const { viewport } = renderVerticalScrollArea();
    mockViewportMetrics(viewport, { scrollHeight: 100, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    expect(viewport).toHaveAttribute("tabindex", "-1");

    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    viewport.dispatchEvent(new Event("scroll", { bubbles: false, cancelable: false }));
    await settle();

    expect(viewport).toHaveAttribute("tabindex", "0");
  });

  it("measures overflow, positions the thumb, and reports overflow edge distances", async () => {
    const { root, viewport } = renderVerticalScrollArea();
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const scrollbar = screen.getByTestId("scrollbar") as HTMLElement;
    const thumb = screen.getByTestId("thumb") as HTMLElement;
    mockElementSize(scrollbar, { offsetWidth: 10, offsetHeight: 100 });
    mockElementSize(thumb, { offsetWidth: 10, offsetHeight: 100 * (100 / 300) });
    await settle();

    expect(root).toHaveAttribute(ScrollAreaRootDataAttributes.hasOverflowY, "");
    expect(root).not.toHaveAttribute(ScrollAreaRootDataAttributes.hasOverflowX);
    expect(viewport).toHaveAttribute(ScrollAreaRootDataAttributes.hasOverflowY, "");

    // At rest the thumb sits at the start with full overflow remaining at the end.
    expect(viewport.style.getPropertyValue(ScrollAreaViewportCssVars.scrollAreaOverflowYStart)).toBe("0px");
    expect(viewport.style.getPropertyValue(ScrollAreaViewportCssVars.scrollAreaOverflowYEnd)).toBe("200px");

    // Mark the interaction as user-driven, then scroll halfway.
    viewport.dispatchEvent(new Event("pointermove", { bubbles: true, cancelable: true }));
    scrollViewport(viewport, 50);
    await settle();

    expect(viewport.style.getPropertyValue(ScrollAreaViewportCssVars.scrollAreaOverflowYStart)).toBe("50px");
    expect(viewport.style.getPropertyValue(ScrollAreaViewportCssVars.scrollAreaOverflowYEnd)).toBe("150px");
    expect(root).toHaveAttribute(ScrollAreaRootDataAttributes.overflowYStart, "");
    expect(root).toHaveAttribute(ScrollAreaRootDataAttributes.overflowYEnd, "");
    expect(root).toHaveAttribute(ScrollAreaRootDataAttributes.scrolling, "");
    expect(viewport).toHaveAttribute(ScrollAreaRootDataAttributes.scrolling, "");

    const maxThumbOffset = 100 - 100 * (100 / 300);
    const expectedOffset = (50 / 200) * maxThumbOffset;
    expect(new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m42).toBeCloseTo(expectedOffset, 3);
  });

  it("clears the scrolling state once scrolling rests", async () => {
    const { root, viewport } = renderVerticalScrollArea();
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    expect(screen.queryByTestId("scrollbar")).not.toBe(null);

    viewport.dispatchEvent(new Event("pointermove", { bubbles: true, cancelable: true }));
    scrollViewport(viewport, 20);
    await settle(1);

    expect(root).toHaveAttribute(ScrollAreaRootDataAttributes.scrolling, "");

    await new Promise((resolve) => setTimeout(resolve, 650));
    flush();

    expect(root).not.toHaveAttribute(ScrollAreaRootDataAttributes.scrolling, "");
  });

  it("applies overflow edge attributes only past the threshold", async () => {
    render(() => (
      <ScrollArea.Root overflowEdgeThreshold={100}>
        <ScrollArea.Viewport data-testid="viewport">
          <ScrollArea.Content>content</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));

    const root = screen.getByTestId("viewport").parentElement as HTMLElement;
    const viewport = screen.getByTestId("viewport") as HTMLElement;
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    expect(root).toHaveAttribute(ScrollAreaRootDataAttributes.hasOverflowY, "");
    expect(root).not.toHaveAttribute(ScrollAreaRootDataAttributes.overflowYStart, "");
    expect(root).toHaveAttribute(ScrollAreaRootDataAttributes.overflowYEnd, "");

    viewport.dispatchEvent(new Event("pointermove", { bubbles: true, cancelable: true }));
    scrollViewport(viewport, 120);
    await settle();

    expect(root).toHaveAttribute(ScrollAreaRootDataAttributes.overflowYStart, "");
    expect(root).not.toHaveAttribute(ScrollAreaRootDataAttributes.overflowYEnd, "");
  });

  it("hides the native scrollbars with the disable class while keeping user classes", async () => {
    const { viewport } = renderVerticalScrollArea();
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    expect(viewport.classList.contains("base-ui-disable-scrollbar")).toBe(true);
    expect(viewport.style.getPropertyValue("overflow")).toBe("scroll");
  });
});
