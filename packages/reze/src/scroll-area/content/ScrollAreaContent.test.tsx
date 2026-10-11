import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as ScrollArea from "../index.parts";
import * as ScrollAreaRootDataAttributes from "../root/ScrollAreaRootDataAttributes";

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

describe("<ScrollArea.Content />", () => {
  it("renders a presentation wrapper that sizes to its content", async () => {
    const { el } = mount(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport>
          <ScrollArea.Content data-testid="content">hello</ScrollArea.Content>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    await settle();

    const content = el.querySelector('[data-testid="content"]') as HTMLElement;
    expect(content).toHaveAttribute("role", "presentation");
    expect(content.style.getPropertyValue("min-width")).toBe("fit-content");
    expect(content).toHaveTextContent("hello");
  });

  it("shares the scroll area state attributes", async () => {
    const { el } = mount(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport data-testid="viewport">
          <ScrollArea.Content data-testid="content">hello</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));

    const viewport = el.querySelector('[data-testid="viewport"]') as HTMLElement;
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, get: () => 300 },
      scrollWidth: { configurable: true, get: () => 100 },
      clientHeight: { configurable: true, get: () => 100 },
      clientWidth: { configurable: true, get: () => 100 },
      scrollTop: { configurable: true, get: () => 0, set: () => {} },
      scrollLeft: { configurable: true, get: () => 0, set: () => {} },
    });
    await settle();

    expect(el.querySelector('[data-testid="content"]')).toHaveAttribute(ScrollAreaRootDataAttributes.hasOverflowY, "");
  });
});
