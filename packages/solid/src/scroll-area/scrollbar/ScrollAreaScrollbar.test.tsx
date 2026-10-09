import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as ScrollArea from "../index.parts";
import * as ScrollAreaScrollbarDataAttributes from "./ScrollAreaScrollbarDataAttributes";

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

function renderScrollbars(props: { keepMounted?: boolean } = {}) {
  render(() => (
    <ScrollArea.Root>
      <ScrollArea.Viewport data-testid="viewport">
        <ScrollArea.Content>content</ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar data-testid="scrollbar-y" keepMounted={props.keepMounted}>
        <ScrollArea.Thumb data-testid="thumb-y" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar data-testid="scrollbar-x" orientation="horizontal" keepMounted={props.keepMounted}>
        <ScrollArea.Thumb data-testid="thumb-x" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  ));

  return screen.getByTestId("viewport") as HTMLElement;
}

describe("<ScrollArea.Scrollbar />", () => {
  it("stays unmounted without overflow and mounts the matching orientation with overflow", async () => {
    const viewport = renderScrollbars();
    mockViewportMetrics(viewport, { scrollHeight: 100, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    expect(screen.queryByTestId("scrollbar-y")).toBe(null);
    expect(screen.queryByTestId("scrollbar-x")).toBe(null);

    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    viewport.dispatchEvent(new Event("scroll", { bubbles: false, cancelable: false }));
    await settle();

    const scrollbar = screen.getByTestId("scrollbar-y") as HTMLElement;
    expect(scrollbar).toHaveAttribute("aria-hidden", "true");
    expect(scrollbar).toHaveAttribute(ScrollAreaScrollbarDataAttributes.orientation, "vertical");
    expect(screen.queryByTestId("scrollbar-x")).toBe(null);
  });

  it("mounts the horizontal scrollbar for horizontal overflow", async () => {
    const viewport = renderScrollbars();
    mockViewportMetrics(viewport, { scrollHeight: 100, scrollWidth: 300, clientHeight: 100, clientWidth: 100 });
    await settle();

    expect(screen.queryByTestId("scrollbar-y")).toBe(null);
    const scrollbar = screen.getByTestId("scrollbar-x") as HTMLElement;
    expect(scrollbar).toHaveAttribute(ScrollAreaScrollbarDataAttributes.orientation, "horizontal");
    expect(scrollbar).toHaveAttribute("aria-hidden", "true");
  });

  it("stays mounted with `keepMounted` and positions itself absolutely", async () => {
    const viewport = renderScrollbars({ keepMounted: true });
    mockViewportMetrics(viewport, { scrollHeight: 100, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const scrollbar = screen.getByTestId("scrollbar-y") as HTMLElement;
    expect(scrollbar.style.getPropertyValue("position")).toBe("absolute");
    expect(scrollbar.style.getPropertyValue("top")).toBe("0px");
    expect(scrollbar.style.getPropertyValue("inset-inline-end")).toBe("0px");
    expect(scrollbar.style.getPropertyValue("touch-action")).toBe("none");
    expect(scrollbar.style.getPropertyValue("user-select")).toBe("none");
    expect(scrollbar.style.getPropertyValue("--scroll-area-thumb-height")).toContain("px");
  });

  it("shows the track while hovering the scroll area", async () => {
    const viewport = renderScrollbars({ keepMounted: true });
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const root = viewport.parentElement as HTMLElement;
    const scrollbar = screen.getByTestId("scrollbar-y") as HTMLElement;

    const enter = new Event("pointerenter", { bubbles: false, cancelable: true });
    root.dispatchEvent(enter);
    flush();

    expect(scrollbar).toHaveAttribute(ScrollAreaScrollbarDataAttributes.hovering, "");

    const leave = new Event("pointerleave", { bubbles: false, cancelable: true });
    root.dispatchEvent(leave);
    flush();

    expect(scrollbar).not.toHaveAttribute(ScrollAreaScrollbarDataAttributes.hovering, "");
  });

  it("scrolls the viewport on wheel without chaining past the edges", async () => {
    const viewport = renderScrollbars({ keepMounted: true });
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const scrollbar = screen.getByTestId("scrollbar-y") as HTMLElement;

    const wheel = new Event("wheel", { bubbles: true, cancelable: true });
    Object.assign(wheel, { deltaX: 0, deltaY: 40, ctrlKey: false });
    scrollbar.dispatchEvent(wheel);

    expect(viewport.scrollTop).toBe(40);
    expect(wheel.defaultPrevented).toBe(true);

    // At the end edge the wheel event must chain to the page instead.
    viewport.scrollTop = 200;
    const edgeWheel = new Event("wheel", { bubbles: true, cancelable: true });
    Object.assign(edgeWheel, { deltaX: 0, deltaY: 40, ctrlKey: false });
    scrollbar.dispatchEvent(edgeWheel);

    expect(viewport.scrollTop).toBe(200);
    expect(edgeWheel.defaultPrevented).toBe(false);
  });

  it("jumps to the clicked track position", async () => {
    const viewport = renderScrollbars();
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const scrollbar = screen.getByTestId("scrollbar-y") as HTMLElement;
    const thumb = screen.getByTestId("thumb-y") as HTMLElement;
    mockElementSize(scrollbar, { offsetWidth: 10, offsetHeight: 100 });
    mockElementSize(thumb, { offsetWidth: 10, offsetHeight: 100 * (100 / 300) });
    scrollbar.getBoundingClientRect = () => ({ top: 0, left: 0, width: 10, height: 100 }) as DOMRect;

    const down = new Event("pointerdown", { bubbles: true, cancelable: true });
    Object.assign(down, { button: 0, buttons: 1, pointerId: 7, pointerType: "mouse", clientX: 5, clientY: 75 });
    scrollbar.dispatchEvent(down);
    flush();

    // Click at 75px of a 100px track with a ~33px thumb centers the thumb at the
    // pointer: ratio (75 - 33/2) / (100 - 33) of the 200px scrollable distance.
    const thumbSize = 100 * (100 / 300);
    const expected = ((75 - thumbSize / 2) / (100 - thumbSize)) * 200;
    expect(viewport.scrollTop).toBeCloseTo(expected, 8);
  });
});
