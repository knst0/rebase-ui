import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as ScrollArea from "./index.parts";

afterEach(() => {
  cleanup();
});

function renderScrollArea(scrollbarsKeepMounted = true) {
  render(() => (
    <ScrollArea.Root data-testid="root">
      <ScrollArea.Viewport data-testid="viewport">
        <ScrollArea.Content data-testid="content">Content</ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar data-testid="scrollbar-y" keepMounted={scrollbarsKeepMounted}>
        <ScrollArea.Thumb data-testid="thumb-y" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar data-testid="scrollbar-x" orientation="horizontal" keepMounted={scrollbarsKeepMounted}>
        <ScrollArea.Thumb data-testid="thumb-x" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner data-testid="corner" />
    </ScrollArea.Root>
  ));
}

describe("ScrollArea", () => {
  it("renders the anatomy with presentation roles", () => {
    renderScrollArea();

    expect(screen.getByTestId("root")).toHaveAttribute("role", "presentation");
    expect(screen.getByTestId("viewport")).toHaveAttribute("role", "presentation");
    expect(screen.getByTestId("content")).toHaveAttribute("role", "presentation");
    expect(screen.getByTestId("content")).toHaveTextContent("Content");
  });

  it("keeps a non-overflowing viewport out of tab order", () => {
    renderScrollArea();

    // Both scrollbars start hidden, so the viewport must not be focusable.
    expect(screen.getByTestId("viewport")).toHaveAttribute("tabindex", "-1");
  });

  it("exposes corner size CSS variables on the root", () => {
    renderScrollArea();

    const root = screen.getByTestId("root");
    expect(root.style.getPropertyValue("--scroll-area-corner-height")).toBe("0px");
    expect(root.style.getPropertyValue("--scroll-area-corner-width")).toBe("0px");
  });

  it("hides the corner until both scrollbars overflow", () => {
    renderScrollArea();

    expect(screen.queryByTestId("corner")).toBeNull();
  });

  it("renders mounted scrollbars with orientation and hidden-from-AT attributes", () => {
    renderScrollArea();

    const scrollbarY = screen.getByTestId("scrollbar-y");
    const scrollbarX = screen.getByTestId("scrollbar-x");

    expect(scrollbarY).toHaveAttribute("data-orientation", "vertical");
    expect(scrollbarX).toHaveAttribute("data-orientation", "horizontal");
    expect(scrollbarY).toHaveAttribute("aria-hidden", "true");
    expect(scrollbarX).toHaveAttribute("aria-hidden", "true");
  });

  it("omits scrollbars without overflow unless keepMounted", () => {
    renderScrollArea(false);

    expect(screen.queryByTestId("scrollbar-y")).toBeNull();
    expect(screen.queryByTestId("scrollbar-x")).toBeNull();
  });

  it("sizes thumbs through kebab-case CSS variables", () => {
    renderScrollArea();

    const scrollbarY = screen.getByTestId("scrollbar-y");
    const scrollbarX = screen.getByTestId("scrollbar-x");
    const thumbY = screen.getByTestId("thumb-y");
    const thumbX = screen.getByTestId("thumb-x");

    expect(scrollbarY.style.getPropertyValue("--scroll-area-thumb-height")).toBe("0px");
    expect(scrollbarX.style.getPropertyValue("--scroll-area-thumb-width")).toBe("0px");
    expect(thumbY.style.getPropertyValue("height")).toBe("var(--scroll-area-thumb-height)");
    expect(thumbX.style.getPropertyValue("width")).toBe("var(--scroll-area-thumb-width)");
  });

  it("keeps content shrink-wrapped with a kebab-case style", () => {
    renderScrollArea();

    expect(screen.getByTestId("content").style.getPropertyValue("min-width")).toBe("fit-content");
  });
});
