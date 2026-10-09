import { describe, expect, it } from "vite-plus/test";

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
});
