import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as ScrollArea from "../index.parts";
import * as ScrollAreaScrollbarDataAttributes from "./ScrollAreaScrollbarDataAttributes";

afterEach(cleanup);

const nextFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });

async function settle(rounds = 3) {
  for (let i = 0; i < rounds; i += 1) {
    tick();
    await nextFrames();
  }
  tick();
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
  const { el } = mount(() => (
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

  return { el, viewport: el.querySelector('[data-testid="viewport"]') as HTMLElement };
}

describe("<ScrollArea.Scrollbar />", () => {
  it("stays unmounted without overflow and mounts the matching orientation with overflow", async () => {
    const { el, viewport } = renderScrollbars();
    mockViewportMetrics(viewport, { scrollHeight: 100, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    expect(el.querySelector('[data-testid="scrollbar-y"]')).toBe(null);
    expect(el.querySelector('[data-testid="scrollbar-x"]')).toBe(null);

    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    viewport.dispatchEvent(new Event("scroll", { bubbles: false, cancelable: false }));
    await settle();

    const scrollbar = el.querySelector('[data-testid="scrollbar-y"]') as HTMLElement;
    expect(scrollbar).toHaveAttribute("aria-hidden", "true");
    expect(scrollbar).toHaveAttribute(ScrollAreaScrollbarDataAttributes.orientation, "vertical");
    expect(el.querySelector('[data-testid="scrollbar-x"]')).toBe(null);
  });

  it("mounts the horizontal scrollbar for horizontal overflow", async () => {
    const { el, viewport } = renderScrollbars();
    mockViewportMetrics(viewport, { scrollHeight: 100, scrollWidth: 300, clientHeight: 100, clientWidth: 100 });
    await settle();

    expect(el.querySelector('[data-testid="scrollbar-y"]')).toBe(null);
    const scrollbar = el.querySelector('[data-testid="scrollbar-x"]') as HTMLElement;
    expect(scrollbar).toHaveAttribute(ScrollAreaScrollbarDataAttributes.orientation, "horizontal");
    expect(scrollbar).toHaveAttribute("aria-hidden", "true");
  });

  it("stays mounted with `keepMounted` and positions itself absolutely", async () => {
    const { el, viewport } = renderScrollbars({ keepMounted: true });
    mockViewportMetrics(viewport, { scrollHeight: 100, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const scrollbar = el.querySelector('[data-testid="scrollbar-y"]') as HTMLElement;
    expect(scrollbar.style.getPropertyValue("position")).toBe("absolute");
    expect(scrollbar.style.getPropertyValue("top")).toBe("0px");
    expect(scrollbar.style.getPropertyValue("inset-inline-end")).toBe("0px");
    expect(scrollbar.style.getPropertyValue("touch-action")).toBe("none");
    expect(scrollbar.style.getPropertyValue("user-select")).toBe("none");
    expect(scrollbar.style.getPropertyValue("--scroll-area-thumb-height")).toContain("px");
  });

  it("shows the track while hovering the scroll area", async () => {
    const { el, viewport } = renderScrollbars({ keepMounted: true });
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const root = viewport.parentElement as HTMLElement;
    const scrollbar = el.querySelector('[data-testid="scrollbar-y"]') as HTMLElement;

    // `pointerenter` doesn't bubble, so dispatch it on the root itself.
    const enter = new Event("pointerenter", { bubbles: false, cancelable: true });
    Object.assign(enter, { pointerType: "mouse" });
    root.dispatchEvent(enter);
    tick();

    expect(scrollbar).toHaveAttribute(ScrollAreaScrollbarDataAttributes.hovering, "");

    const leave = new Event("pointerleave", { bubbles: false, cancelable: true });
    root.dispatchEvent(leave);
    tick();

    expect(scrollbar).not.toHaveAttribute(ScrollAreaScrollbarDataAttributes.hovering, "");
  });

  it("scrolls the viewport on wheel without chaining past the edges", async () => {
    const { el, viewport } = renderScrollbars({ keepMounted: true });
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const scrollbar = el.querySelector('[data-testid="scrollbar-y"]') as HTMLElement;

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

  it("preserves the viewport node and its scroll position when the scrollbar mounts", async () => {
    const { el, viewport } = renderScrollbars();
    mockViewportMetrics(viewport, { scrollHeight: 100, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    expect(el.querySelector('[data-testid="scrollbar-y"]')).toBe(null);

    // Scroll while there is no overflow yet; mounting the scrollbar must not
    // recreate the viewport (which would reset the scroll position).
    viewport.scrollTop = 30;
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100, scrollTop: 30 });
    viewport.dispatchEvent(new Event("scroll", { bubbles: false, cancelable: false }));
    await settle();

    expect(el.querySelector('[data-testid="scrollbar-y"]')).not.toBe(null);
    expect(el.querySelector('[data-testid="viewport"]')).toBe(viewport);
    expect(viewport.scrollTop).toBe(30);
  });

  it("jumps to the clicked track position", async () => {
    const { el, viewport } = renderScrollbars();
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    const scrollbar = el.querySelector('[data-testid="scrollbar-y"]') as HTMLElement;
    const thumb = el.querySelector('[data-testid="thumb-y"]') as HTMLElement;
    mockElementSize(scrollbar, { offsetWidth: 10, offsetHeight: 100 });
    mockElementSize(thumb, { offsetWidth: 10, offsetHeight: 100 * (100 / 300) });
    scrollbar.getBoundingClientRect = () => ({ top: 0, left: 0, width: 10, height: 100 }) as DOMRect;

    const down = new Event("pointerdown", { bubbles: true, cancelable: true });
    Object.assign(down, { button: 0, buttons: 1, pointerId: 7, pointerType: "mouse", clientX: 5, clientY: 75 });
    scrollbar.dispatchEvent(down);
    tick();

    // Click at 75px of a 100px track with a ~33px thumb centers the thumb at the
    // pointer: ratio (75 - 33/2) / (100 - 33) of the 200px scrollable distance.
    const thumbSize = 100 * (100 / 300);
    const expected = ((75 - thumbSize / 2) / (100 - thumbSize)) * 200;
    expect(viewport.scrollTop).toBeCloseTo(expected, 8);
  });
});
