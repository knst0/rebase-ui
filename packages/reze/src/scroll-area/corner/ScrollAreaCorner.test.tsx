import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as ScrollArea from "../index.parts";
import * as ScrollAreaRootCssVars from "../root/ScrollAreaRootCssVars";

afterEach(cleanup);

const nextFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });

async function settle(rounds = 4) {
  for (let i = 0; i < rounds; i += 1) {
    tick();
    await nextFrames();
  }
  tick();
}

function mockViewportMetrics(
  element: HTMLElement,
  metrics: { scrollHeight: number; scrollWidth: number; clientHeight: number; clientWidth: number },
) {
  Object.defineProperties(element, {
    scrollHeight: { configurable: true, get: () => metrics.scrollHeight },
    scrollWidth: { configurable: true, get: () => metrics.scrollWidth },
    clientHeight: { configurable: true, get: () => metrics.clientHeight },
    clientWidth: { configurable: true, get: () => metrics.clientWidth },
    scrollTop: { configurable: true, get: () => 0, set: () => {} },
    scrollLeft: { configurable: true, get: () => 0, set: () => {} },
  });
}

function mockElementSize(element: HTMLElement, size: { offsetWidth?: number; offsetHeight?: number }) {
  Object.defineProperties(element, {
    offsetWidth: { configurable: true, get: () => size.offsetWidth ?? 0 },
    offsetHeight: { configurable: true, get: () => size.offsetHeight ?? 0 },
  });
}

function renderCornerTree() {
  const { el } = mount(() => (
    <ScrollArea.Root>
      <ScrollArea.Viewport data-testid="viewport">
        <ScrollArea.Content>content</ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar data-testid="scrollbar-y">
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar data-testid="scrollbar-x" orientation="horizontal">
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner data-testid="corner" />
    </ScrollArea.Root>
  ));

  return {
    el,
    root: el.querySelector('[data-testid="viewport"]')!.parentElement as HTMLElement,
    viewport: el.querySelector('[data-testid="viewport"]') as HTMLElement,
  };
}

describe("<ScrollArea.Corner />", () => {
  it("stays unmounted unless both scrollbars overflow", async () => {
    const { el, viewport } = renderCornerTree();
    mockViewportMetrics(viewport, { scrollHeight: 100, scrollWidth: 100, clientHeight: 100, clientWidth: 100 });
    await settle();

    expect(el.querySelector('[data-testid="corner"]')).toBe(null);
  });

  it("fills the intersection of both scrollbars and reports its size", async () => {
    const { el, root, viewport } = renderCornerTree();
    mockViewportMetrics(viewport, { scrollHeight: 300, scrollWidth: 300, clientHeight: 100, clientWidth: 100 });
    await settle();

    const scrollbarY = el.querySelector('[data-testid="scrollbar-y"]') as HTMLElement;
    const scrollbarX = el.querySelector('[data-testid="scrollbar-x"]') as HTMLElement;
    mockElementSize(scrollbarY, { offsetWidth: 10, offsetHeight: 100 });
    mockElementSize(scrollbarX, { offsetWidth: 100, offsetHeight: 12 });
    // Re-measure now that the scrollbar boxes have sizes.
    viewport.dispatchEvent(new Event("scroll", { bubbles: false, cancelable: false }));
    await settle();

    const corner = el.querySelector('[data-testid="corner"]') as HTMLElement;
    expect(corner).toHaveAttribute("aria-hidden", "true");
    expect(corner.style.getPropertyValue("position")).toBe("absolute");
    expect(corner.style.getPropertyValue("bottom")).toBe("0px");
    expect(corner.style.getPropertyValue("inset-inline-end")).toBe("0px");
    expect(corner.style.getPropertyValue("width")).toBe("10px");
    expect(corner.style.getPropertyValue("height")).toBe("12px");

    expect(root.style.getPropertyValue(ScrollAreaRootCssVars.scrollAreaCornerWidth)).toBe("10px");
    expect(root.style.getPropertyValue(ScrollAreaRootCssVars.scrollAreaCornerHeight)).toBe("12px");
  });
});
