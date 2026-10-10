import { describe, expect, it } from "vite-plus/test";

import { getFilter } from "./filter";

describe("getFilter", () => {
  it("matches case- and diacritics-insensitively with contains", () => {
    const filter = getFilter();
    expect(filter.contains("Crème brûlée", "creme")).toBe(true);
    expect(filter.contains("Apple", "APP")).toBe(true);
    expect(filter.contains("Apple", "z")).toBe(false);
  });

  it("returns true for an empty query", () => {
    const filter = getFilter();
    expect(filter.contains("Apple", "")).toBe(true);
    expect(filter.startsWith("Apple", "")).toBe(true);
    expect(filter.endsWith("Apple", "")).toBe(true);
  });

  it("matches prefixes and suffixes", () => {
    const filter = getFilter();
    expect(filter.startsWith("Banana", "ban")).toBe(true);
    expect(filter.startsWith("Banana", "ana")).toBe(false);
    expect(filter.endsWith("Banana", "ANA")).toBe(true);
    expect(filter.endsWith("Banana", "ban")).toBe(false);
  });

  it("uses itemToStringLabel and object labels", () => {
    const filter = getFilter();
    expect(filter.contains({ label: "Cherry", value: "c" }, "cher")).toBe(true);
    expect(filter.contains({ value: 42 }, "value", (item) => `value:${item.value}`)).toBe(true);
  });

  it("caches filters with equal options", () => {
    expect(getFilter({ locale: "en" })).toBe(getFilter({ locale: "en" }));
    expect(getFilter({ locale: "en" })).not.toBe(getFilter({ locale: "fr" }));
  });
});
