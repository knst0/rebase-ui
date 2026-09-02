import { describe, expect, it } from "vitest";

import { orderByDocumentPosition } from "./documentOrder";

function tree(depth: number, breadth: number) {
  const root = document.createElement("div");
  const leaves: HTMLElement[] = [];

  const build = (parent: HTMLElement, level: number) => {
    for (let index = 0; index < breadth; index += 1) {
      const child = document.createElement("div");
      parent.appendChild(child);
      if (level === depth) {
        leaves.push(child);
      } else {
        build(child, level + 1);
      }
    }
  };

  build(root, 1);
  return { root, leaves };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

describe("orderByDocumentPosition", () => {
  it("returns fewer than two elements untouched", () => {
    const element = document.createElement("div");
    expect(orderByDocumentPosition([])).toEqual([]);
    expect(orderByDocumentPosition([element])).toEqual([element]);
  });

  it("orders siblings by document position", () => {
    const { root, leaves } = tree(1, 8);
    document.body.appendChild(root);

    expect(orderByDocumentPosition(shuffle(leaves))).toEqual(leaves);
    root.remove();
  });

  it("orders elements nested at different depths", () => {
    const root = document.createElement("div");
    root.innerHTML = "<a></a><b><c></c><d><e></e></d></b><f></f>";
    document.body.appendChild(root);

    const expected = [...root.querySelectorAll("*")] as HTMLElement[];
    expect(orderByDocumentPosition(shuffle(expected))).toEqual(expected);
    root.remove();
  });

  it("orders an ancestor before its own descendants", () => {
    const root = document.createElement("div");
    root.innerHTML = "<span></span>";
    document.body.appendChild(root);

    const child = root.firstElementChild as HTMLElement;
    expect(orderByDocumentPosition([child, root])).toEqual([root, child]);
    root.remove();
  });

  it("orders detached subtrees", () => {
    const { root, leaves } = tree(2, 3);
    expect(orderByDocumentPosition(shuffle(leaves))).toEqual(leaves);
    expect(root.isConnected).toBe(false);
  });

  it("falls back to sorting when elements span unrelated trees", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    document.body.append(first, second);

    const detached = document.createElement("div");
    const ordered = orderByDocumentPosition([second, first, detached]);

    expect(ordered).toHaveLength(3);
    expect(ordered.indexOf(first)).toBeLessThan(ordered.indexOf(second));

    first.remove();
    second.remove();
  });

  it("orders elements whose only common ancestor is the page body", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    document.body.append(first, second);

    expect(orderByDocumentPosition([second, first])).toEqual([first, second]);

    first.remove();
    second.remove();
  });

  it("stays correct after the elements are reordered in the DOM", () => {
    const { root, leaves } = tree(1, 6);
    document.body.appendChild(root);

    root.prepend(leaves[5]);
    const expected = [leaves[5], ...leaves.slice(0, 5)];

    expect(orderByDocumentPosition(shuffle(leaves))).toEqual(expected);
    root.remove();
  });

  it("falls back to sorting rather than exhausting its visit budget", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const filler = Array.from({ length: 500 }, () => {
      const element = document.createElement("i");
      root.appendChild(element);
      return element;
    });

    const targets = [filler[0], filler[499]];
    expect(orderByDocumentPosition([targets[1], targets[0]])).toEqual(targets);

    root.remove();
  });

  it("agrees with a compareDocumentPosition sort on random trees", () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const { root, leaves } = tree(2, 4);
      document.body.appendChild(root);

      const all = [...root.querySelectorAll("*")] as HTMLElement[];
      const sample = shuffle(all).slice(0, 6 + (iteration % 5));
      const expected = all.filter((element) => sample.includes(element));

      expect(orderByDocumentPosition(sample)).toEqual(expected);
      expect(leaves.length).toBeGreaterThan(0);
      root.remove();
    }
  });
});
