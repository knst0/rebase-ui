import { describe, expect, it, vi } from "vite-plus/test";

import { sortByDocumentPosition } from "./composite";

describe("sortByDocumentPosition", () => {
  function createList(count: number, attached: boolean) {
    const container = document.createElement("div");
    const elements = Array.from({ length: count }, () => document.createElement("button"));

    for (const element of elements) {
      container.appendChild(element);
    }

    if (attached) {
      document.body.appendChild(container);
    }

    return { container, elements };
  }

  it("keeps attached elements in document order regardless of registration order", () => {
    const { elements } = createList(3, true);

    let sorted: HTMLElement[] = [];
    for (const element of [elements[2], elements[0], elements[1]]) {
      sorted = sortByDocumentPosition(sorted, element);
    }

    expect(sorted).toEqual(elements);
  });

  it("falls back to registration order for detached elements", () => {
    const { elements } = createList(3, false);

    let sorted: HTMLElement[] = [];
    for (const element of elements) {
      sorted = sortByDocumentPosition(sorted, element);
    }

    expect(sorted).toEqual(elements);
  });

  it("does not reorder detached elements against already-sorted ones", () => {
    const { elements } = createList(3, false);

    let sorted = sortByDocumentPosition([], elements[0]);
    sorted = sortByDocumentPosition(sorted, elements[1]);

    expect(sorted).toEqual([elements[0], elements[1]]);
  });

  it("orders adjacent siblings without calling compareDocumentPosition", () => {
    const { container, elements } = createList(3, true);
    const spies = elements.map((element) => vi.spyOn(element, "compareDocumentPosition"));

    try {
      let sorted = sortByDocumentPosition([], elements[0]);
      sorted = sortByDocumentPosition(sorted, elements[1]);
      expect(sorted).toEqual([elements[0], elements[1]]);

      sorted = sortByDocumentPosition([elements[1]], elements[0]);
      expect(sorted).toEqual([elements[0], elements[1]]);

      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
      }
    } finally {
      for (const spy of spies) {
        spy.mockRestore();
      }
      container.remove();
    }
  });

  it("still falls back to compareDocumentPosition for non-adjacent elements", () => {
    const { container, elements } = createList(3, true);
    const spy = vi.spyOn(elements[0], "compareDocumentPosition");

    try {
      // elements[0] and elements[2] are not adjacent siblings.
      const sorted = sortByDocumentPosition([elements[0]], elements[2]);
      expect(sorted).toEqual([elements[0], elements[2]]);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      container.remove();
    }
  });
});
