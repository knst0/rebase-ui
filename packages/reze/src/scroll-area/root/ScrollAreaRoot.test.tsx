import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { createContext, useContext } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as ScrollArea from "../index.parts";
import * as ScrollAreaRootCssVars from "./ScrollAreaRootCssVars";

afterEach(cleanup);

describe("<ScrollArea.Root />", () => {
  it("keeps providers surrounding the root for its parts", () => {
    const Outer = createContext("missing");
    function Reader() {
      return <span data-testid="reader">{useContext(Outer)}</span>;
    }
    const { el } = mount(() => (
      <Outer value="provided">
        <ScrollArea.Root>
          <ScrollArea.Viewport>
            <Reader />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      </Outer>
    ));

    expect(el.querySelector('[data-testid="reader"]')).toHaveTextContent("provided");
  });

  it("renders a presentation div by default", () => {
    const { el } = mount(() => <ScrollArea.Root data-testid="root" />);

    const root = el.querySelector('[data-testid="root"]') as HTMLElement;
    expect(root.tagName).toBe("DIV");
    expect(root).toHaveAttribute("role", "presentation");
  });

  it("renders the customized root element", () => {
    const { el } = mount(() => <ScrollArea.Root as="section" data-testid="root" />);

    expect((el.querySelector('[data-testid="root"]') as HTMLElement).tagName).toBe("SECTION");
  });

  it("supports component values for `as`", () => {
    function Fancy(props: Record<string, unknown>) {
      // Spread so the attribute stays on the element: `role` on a lowercase intrinsic
      // trips the reze-lsp UNKNOWN_ATTRIBUTE false positive (see MeterRootElement).
      const presentationRole = { role: props.role as "presentation" };
      return (
        <section data-fancy="true" {...presentationRole}>
          {props.children as never}
        </section>
      );
    }
    const { el } = mount(() => (
      <ScrollArea.Root as={Fancy}>
        <ScrollArea.Viewport data-testid="viewport">
          <ScrollArea.Content>content</ScrollArea.Content>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    tick();

    const section = el.querySelector("section");
    expect(section?.getAttribute("data-fancy")).toBe("true");
    expect(section?.getAttribute("role")).toBe("presentation");
    expect(el.querySelector('[data-testid="viewport"]')).not.toBe(null);
  });

  it("exposes zeroed corner CSS variables before measurement", () => {
    const { el } = mount(() => <ScrollArea.Root data-testid="root" />);
    tick();

    const root = el.querySelector('[data-testid="root"]') as HTMLElement;
    expect(root.style.getPropertyValue(ScrollAreaRootCssVars.scrollAreaCornerHeight)).toBe("0px");
    expect(root.style.getPropertyValue(ScrollAreaRootCssVars.scrollAreaCornerWidth)).toBe("0px");
    expect(root.style.getPropertyValue("position")).toBe("relative");
  });

  it("merges user styles with the internal positioning styles", () => {
    const { el } = mount(() => (
      <ScrollArea.Root data-testid="root" style={{ color: "green" }}>
        content
      </ScrollArea.Root>
    ));
    tick();

    const root = el.querySelector('[data-testid="root"]') as HTMLElement;
    expect(root.style.getPropertyValue("color")).toBe("green");
    expect(root.style.getPropertyValue("position")).toBe("relative");
  });

  it("injects a stylesheet that hides the native scrollbars", () => {
    const { el } = mount(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport>
          <ScrollArea.Content>content</ScrollArea.Content>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    tick();

    const style = el.querySelector("style");
    expect(style?.textContent).toContain("scrollbar-width:none");
    expect(style?.textContent).toContain("::-webkit-scrollbar");
  });

  it("calls the class function with the root state", () => {
    let stateArgument: unknown;
    const { el } = mount(() => (
      <ScrollArea.Root
        data-testid="root"
        class={(state) => {
          stateArgument = state;
          return "";
        }}
      />
    ));
    tick();

    expect(el.querySelector('[data-testid="root"]')).toBeTruthy();
    expect(stateArgument).toEqual({
      scrolling: false,
      hasOverflowX: false,
      hasOverflowY: false,
      overflowXStart: false,
      overflowXEnd: false,
      overflowYStart: false,
      overflowYEnd: false,
      cornerHidden: true,
    });
  });

  it("renders children defined as a function of state", () => {
    const { el } = mount(() => (
      <ScrollArea.Root data-testid="root">{(state) => (state.cornerHidden ? "hidden" : "shown")}</ScrollArea.Root>
    ));
    tick();

    expect((el.querySelector('[data-testid="root"]') as HTMLElement).textContent).toBe("hidden");
  });

  it("attaches a callback ref to the root element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <ScrollArea.Root
        data-testid="root"
        ref={(value: HTMLElement) => {
          instance = value;
        }}
      />
    ));
    tick();

    expect(instance).toBe(el.querySelector('[data-testid="root"]'));
  });
});
