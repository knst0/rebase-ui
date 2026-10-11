import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as Avatar from "../index.parts";

afterEach(cleanup);

function getRoot(root: ParentNode): HTMLElement {
  const found = root.querySelector('[data-testid="root"]');
  if (!(found instanceof HTMLElement)) {
    throw new Error("avatar root not found");
  }
  return found;
}

describe("<Avatar.Root />", () => {
  it("renders a span element by default", () => {
    const { el } = mount(() => <Avatar.Root data-testid="root" />);

    expect(getRoot(el).tagName).toBe("SPAN");
  });

  it("renders the customized root element with the as prop", () => {
    const { el } = mount(() => <Avatar.Root data-testid="root" as="div" />);

    expect(getRoot(el).tagName).toBe("DIV");
  });

  it("attaches a callback ref to the root element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <Avatar.Root
        data-testid="root"
        ref={(value: HTMLElement) => {
          instance = value;
        }}
      />
    ));

    expect(instance).toBe(getRoot(el));
    expect(instance).toBeInstanceOf(window.HTMLSpanElement);
  });

  it("renders its children", () => {
    const { el } = mount(() => (
      <Avatar.Root data-testid="root">
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    expect(getRoot(el).textContent).toBe("JD");
  });

  it("renders the fallback when it has no image", () => {
    const { el } = mount(() => (
      <Avatar.Root data-testid="root">
        <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
      </Avatar.Root>
    ));

    const fallback = el.querySelector('[data-testid="fallback"]');
    expect(fallback).toBeInstanceOf(window.HTMLSpanElement);
    expect(getRoot(el)).toContainElement(fallback as HTMLElement);
  });

  it("calls the class function with the component state", () => {
    let stateArgument: unknown;
    const { el } = mount(() => (
      <Avatar.Root
        data-testid="root"
        class={(state) => {
          stateArgument = state;
          return "";
        }}
      />
    ));

    tick();

    expect(getRoot(el)).toBeTruthy();
    expect(stateArgument).toEqual({ imageLoadingStatus: "idle" });
  });

  it("renders children defined as a function of state", () => {
    const { el } = mount(() => (
      <Avatar.Root data-testid="root">{(state) => (state.imageLoadingStatus === "idle" ? "idle" : "busy")}</Avatar.Root>
    ));

    tick();

    expect(getRoot(el).textContent).toBe("idle");
  });
});
