import { afterEach, describe, expect, it } from "vite-plus/test";

import { findScrollableAncestor, findScrollableTouchTarget } from "./scrollable";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function mockScrollMetrics(element: HTMLElement, scrollSize: number, clientSize: number, axis: "vertical" | "horizontal" = "vertical") {
  if (axis === "vertical") {
    Object.defineProperty(element, "scrollHeight", { value: scrollSize, configurable: true });
    Object.defineProperty(element, "clientHeight", { value: clientSize, configurable: true });
  } else {
    Object.defineProperty(element, "scrollWidth", { value: scrollSize, configurable: true });
    Object.defineProperty(element, "clientWidth", { value: clientSize, configurable: true });
  }
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("findScrollableAncestor", () => {
  it("returns the scrollable ancestor of an HTML target", () => {
    const root = document.createElement("div");
    const scroll = document.createElement("div");
    scroll.style.overflowY = "auto";
    mockScrollMetrics(scroll, 160, 40);
    const target = document.createElement("div");
    scroll.appendChild(target);
    root.appendChild(scroll);
    document.body.appendChild(root);

    expect(findScrollableAncestor(target, root, "vertical")).toBe(scroll);
    expect(findScrollableAncestor(target, root, "horizontal")).toBe(null);
  });

  it("returns the scrollable ancestor of an SVG target", () => {
    const root = document.createElement("div");
    const scroll = document.createElement("div");
    scroll.style.overflowY = "auto";
    mockScrollMetrics(scroll, 160, 40);
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    const rect = document.createElementNS(SVG_NAMESPACE, "rect");
    svg.appendChild(rect);
    scroll.appendChild(svg);
    root.appendChild(scroll);
    document.body.appendChild(root);

    // Non-HTML targets can't scroll, but their HTML ancestors can.
    expect(findScrollableAncestor(rect, root, "vertical")).toBe(scroll);
  });

  it("returns null without a scrollable ancestor and stops at the root", () => {
    const root = document.createElement("div");
    root.style.overflowY = "auto";
    mockScrollMetrics(root, 160, 40);
    const target = document.createElement("div");
    root.appendChild(target);
    document.body.appendChild(root);

    expect(findScrollableAncestor(target, root, "vertical")).toBe(null);
    expect(findScrollableAncestor(null, root, "vertical")).toBe(null);
    expect(findScrollableAncestor(document.createTextNode("text"), root, "vertical")).toBe(null);
  });
});

describe("findScrollableTouchTarget", () => {
  it("finds scrollable ancestors of SVG targets and falls back to the root", () => {
    const root = document.createElement("div");
    const scroll = document.createElement("div");
    scroll.style.overflowY = "auto";
    mockScrollMetrics(scroll, 160, 40);
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    const rect = document.createElementNS(SVG_NAMESPACE, "rect");
    svg.appendChild(rect);
    scroll.appendChild(svg);
    root.appendChild(scroll);
    document.body.appendChild(root);

    expect(findScrollableTouchTarget(rect, root, "vertical")).toBe(scroll);

    const scrollableRoot = document.createElement("div");
    scrollableRoot.style.overflowY = "auto";
    mockScrollMetrics(scrollableRoot, 160, 40);
    const child = document.createElement("div");
    scrollableRoot.appendChild(child);
    document.body.appendChild(scrollableRoot);

    expect(findScrollableTouchTarget(child, scrollableRoot, "vertical")).toBe(scrollableRoot);
  });
});
