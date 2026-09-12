import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { describeConformance } from "#test-utils";

import * as ScrollArea from "../index.parts";
import * as ScrollAreaRootCssVars from "./ScrollAreaRootCssVars";

describe("<ScrollArea.Root />", () => {
  describeConformance((props) => <ScrollArea.Root {...props} />, () => ({
    defaultElement: "div",
    refInstanceof: window.HTMLDivElement,
    stateAttributes: {},
  }));

  it("renders a presentation element", () => {
    render(() => <ScrollArea.Root data-testid="root" />);
    flush();

    expect(screen.getByTestId("root")).toHaveAttribute("role", "presentation");
  });

  it("exposes zeroed corner CSS variables before measurement", () => {
    render(() => <ScrollArea.Root data-testid="root" />);
    flush();

    const root = screen.getByTestId("root") as HTMLElement;
    expect(root.style.getPropertyValue(ScrollAreaRootCssVars.scrollAreaCornerHeight)).toBe("0px");
    expect(root.style.getPropertyValue(ScrollAreaRootCssVars.scrollAreaCornerWidth)).toBe("0px");
    expect(root.style.getPropertyValue("position")).toBe("relative");
  });

  it("merges user styles with the internal positioning styles", () => {
    render(() => (
      <ScrollArea.Root data-testid="root" style={{ color: "green" }}>
        content
      </ScrollArea.Root>
    ));
    flush();

    const root = screen.getByTestId("root") as HTMLElement;
    expect(root.style.getPropertyValue("color")).toBe("green");
    expect(root.style.getPropertyValue("position")).toBe("relative");
  });

  it("injects a stylesheet that hides the native scrollbars", () => {
    const { container } = render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport>
          <ScrollArea.Content>content</ScrollArea.Content>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    flush();

    const style = container.querySelector("style");
    expect(style?.textContent).toContain("scrollbar-width:none");
    expect(style?.textContent).toContain("::-webkit-scrollbar");
  });
});
