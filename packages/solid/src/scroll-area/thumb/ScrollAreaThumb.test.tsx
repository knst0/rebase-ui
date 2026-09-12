import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as ScrollArea from "../index.parts";
import * as ScrollAreaRootDataAttributes from "../root/ScrollAreaRootDataAttributes";
import * as ScrollAreaThumbDataAttributes from "./ScrollAreaThumbDataAttributes";

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

function dispatchPointer(target: EventTarget, type: string, init: Record<string, unknown> = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { button: 0, buttons: 1, pointerId: 1, pointerType: "mouse", clientX: 0, clientY: 0, ...init });
  target.dispatchEvent(event);
}

function renderThumbTree() {
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

describe("<ScrollArea.Thumb />", () => {
  it("reports orientation and sizes itself from the thumb variable", async () => {
    const { viewport } = renderThumbTree();
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const thumb = screen.getByTestId("thumb") as HTMLElement;
    expect(thumb).toHaveAttribute(ScrollAreaThumbDataAttributes.orientation, "vertical");
    expect(thumb.style.getPropertyValue("height")).toBe("var(--scroll-area-thumb-height)");
    // Measured on the first pass, so the track no longer hides the thumb.
    expect(thumb.style.getPropertyValue("visibility")).toBe("");
  });

  it("drags the viewport and marks the scroll area as scrolling until release", async () => {
    const { root, viewport } = renderThumbTree();
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const scrollbar = screen.getByTestId("scrollbar") as HTMLElement;
    const thumb = screen.getByTestId("thumb") as HTMLElement;
    mockElementSize(scrollbar, { offsetWidth: 10, offsetHeight: 100 });
    mockElementSize(thumb, { offsetWidth: 10, offsetHeight: 100 * (100 / 300) });

    dispatchPointer(thumb, "pointerdown", { pointerId: 5, clientY: 20 });
    dispatchPointer(thumb, "pointermove", { pointerId: 5, clientY: 45 });
    flush();

    expect(root).toHaveAttribute(ScrollAreaRootDataAttributes.scrolling, "");
    expect(thumb).toHaveAttribute(ScrollAreaThumbDataAttributes.scrolling, "");

    // Dragged 25px of a ~67px track range over a 200px scrollable distance.
    const thumbSize = 100 * (100 / 300);
    expect(viewport.scrollTop).toBeCloseTo((25 / (100 - thumbSize)) * 200, 8);

    dispatchPointer(thumb, "pointerup", { pointerId: 5 });
    flush();

    expect(root).not.toHaveAttribute(ScrollAreaRootDataAttributes.scrolling, "");
  });

  it("ignores non-primary buttons and foreign pointers", async () => {
    const { viewport } = renderThumbTree();
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const scrollbar = screen.getByTestId("scrollbar") as HTMLElement;
    const thumb = screen.getByTestId("thumb") as HTMLElement;
    mockElementSize(scrollbar, { offsetWidth: 10, offsetHeight: 100 });
    mockElementSize(thumb, { offsetWidth: 10, offsetHeight: 100 * (100 / 300) });

    dispatchPointer(thumb, "pointerdown", { button: 2, buttons: 2, pointerId: 5, clientY: 20 });
    dispatchPointer(thumb, "pointermove", { pointerId: 9, clientY: 80 });
    flush();

    expect(viewport.scrollTop).toBe(0);
  });

  it("treats a buttonless move as a missed release", async () => {
    const { root, viewport } = renderThumbTree();
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const scrollbar = screen.getByTestId("scrollbar") as HTMLElement;
    const thumb = screen.getByTestId("thumb") as HTMLElement;
    mockElementSize(scrollbar, { offsetWidth: 10, offsetHeight: 100 });
    mockElementSize(thumb, { offsetWidth: 10, offsetHeight: 100 * (100 / 300) });

    dispatchPointer(thumb, "pointerdown", { pointerId: 5, clientY: 20 });
    dispatchPointer(thumb, "pointermove", { pointerId: 5, clientY: 45 });
    flush();

    expect(viewport.scrollTop).toBeGreaterThan(0);

    const scrolled = viewport.scrollTop;
    // The release went missing; a move without buttons held ends the drag.
    dispatchPointer(thumb, "pointermove", { pointerId: 5, buttons: 0, clientY: 90 });
    dispatchPointer(thumb, "pointermove", { pointerId: 5, buttons: 0, clientY: 95 });
    flush();

    expect(viewport.scrollTop).toBe(scrolled);
    expect(root).not.toHaveAttribute(ScrollAreaRootDataAttributes.scrolling, "");
  });
});
