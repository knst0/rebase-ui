import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as ScrollArea from "../index.parts";
import * as ScrollAreaRootDataAttributes from "../root/ScrollAreaRootDataAttributes";

async function settle(rounds = 3) {
  for (let i = 0; i < rounds; i += 1) {
    flush();
    await nextFrames();
  }
  flush();
}

describe("<ScrollArea.Content />", () => {
  it("renders a presentation wrapper that sizes to its content", async () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport>
          <ScrollArea.Content data-testid="content">hello</ScrollArea.Content>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    await settle();

    const content = screen.getByTestId("content") as HTMLElement;
    expect(content).toHaveAttribute("role", "presentation");
    expect(content.style.getPropertyValue("min-width")).toBe("fit-content");
    expect(content).toHaveTextContent("hello");
  });

  it("shares the scroll area state attributes", async () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport data-testid="viewport">
          <ScrollArea.Content data-testid="content">hello</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));

    const viewport = screen.getByTestId("viewport") as HTMLElement;
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, get: () => 300 },
      scrollWidth: { configurable: true, get: () => 100 },
      clientHeight: { configurable: true, get: () => 100 },
      clientWidth: { configurable: true, get: () => 100 },
      scrollTop: { configurable: true, get: () => 0, set: () => {} },
      scrollLeft: { configurable: true, get: () => 0, set: () => {} },
    });
    await settle();

    expect(screen.getByTestId("content")).toHaveAttribute(ScrollAreaRootDataAttributes.hasOverflowY, "");
  });
});
