import { describe, expect, it } from "vite-plus/test";

import { countCalls, countLayoutReads } from "./perf";

describe("countLayoutReads", () => {
  it("counts reads per channel and restores the originals", async () => {
    const originalGetComputedStyle = window.getComputedStyle;
    const element = document.createElement("div");
    document.body.append(element);

    const { result, counts } = await countLayoutReads(() => {
      window.getComputedStyle(element);
      window.getComputedStyle(element);
      void element.scrollHeight;
      void element.scrollWidth;
      void element.scrollWidth;
      return "done";
    });

    expect(result).toBe("done");
    expect(counts).toEqual({ getComputedStyle: 2, scrollHeight: 1, scrollWidth: 2, total: 5 });
    expect(window.getComputedStyle).toBe(originalGetComputedStyle);

    const before = counts.total;
    void element.scrollHeight;
    window.getComputedStyle(element);
    expect(counts.total).toBe(before);

    element.remove();
  });

  it("restores the originals when fn throws", async () => {
    const originalGetComputedStyle = window.getComputedStyle;

    await expect(
      countLayoutReads(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(window.getComputedStyle).toBe(originalGetComputedStyle);
  });
});

describe("countCalls", () => {
  it("tallies wrapped calls and resets", () => {
    const tally = countCalls();
    const wrapped = tally.wrap((value: number) => value * 2);

    expect(wrapped(2)).toBe(4);
    expect(wrapped(3)).toBe(6);
    expect(tally.count).toBe(2);

    tally.reset();
    expect(tally.count).toBe(0);
  });
});
