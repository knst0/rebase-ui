import { describe, expect, it } from "vite-plus/test";

import { getFilter, useComboboxFilter } from "./useFilter";

describe("getFilter", () => {
  it("matches case-insensitively by default", () => {
    const filter = getFilter({ locale: "en" });

    expect(filter.contains("Apple", "app")).toBe(true);
    expect(filter.contains("Apple", "APP")).toBe(true);
    expect(filter.contains("Banana", "nan")).toBe(true);
    expect(filter.contains("Banana", "xyz")).toBe(false);
  });

  it("matches diacritics-insensitively by default", () => {
    const filter = getFilter({ locale: "en" });

    expect(filter.contains("Café", "cafe")).toBe(true);
    expect(filter.contains("naïve", "NAI")).toBe(true);
    expect(filter.contains("Zürich", "zurich")).toBe(true);
  });

  it("rejects nullish items and matches empty queries", () => {
    const filter = getFilter({ locale: "en" });

    expect(filter.contains(null, "app")).toBe(false);
    expect(filter.contains(undefined, "app")).toBe(false);
    expect(filter.contains("Apple", "")).toBe(true);
  });

  it("trims the query before matching", () => {
    const filter = getFilter({ locale: "en" });

    expect(filter.contains("Apple", "  app  ")).toBe(true);
  });

  it("projects object items through itemToString", () => {
    const filter = getFilter({ locale: "en" });

    expect(filter.contains({ name: "Banana" }, "nan", (item: { name: string }) => item.name)).toBe(true);
    expect(filter.contains({ name: "Banana" }, "app", (item: { name: string }) => item.name)).toBe(false);
  });

  it("falls back to value and primitive labels without itemToString", () => {
    const filter = getFilter({ locale: "en" });

    expect(filter.contains({ value: "US", label: "United States" }, "united")).toBe(true);
    expect(filter.contains(42, "4")).toBe(true);
  });

  it("matches prefixes through startsWith", () => {
    const filter = getFilter({ locale: "en" });

    expect(filter.startsWith("Apple", "app")).toBe(true);
    expect(filter.startsWith("Pineapple", "app")).toBe(false);
    expect(filter.startsWith("Pineapple", "pine")).toBe(true);
  });

  it("respects case-sensitive matching when ignoreCase is false", () => {
    const filter = getFilter({ locale: "en", ignoreCase: false });

    expect(filter.contains("Apple", "app")).toBe(false);
    expect(filter.contains("Apple", "App")).toBe(true);
  });
});

describe("useComboboxFilter", () => {
  it("uses default options when called without arguments", () => {
    const filter = useComboboxFilter();

    expect(filter.contains("Apple", "app")).toBe(true);
  });

  it("filters selected and unselected items in single and multiple modes", () => {
    const single = useComboboxFilter({ locale: "en", multiple: false, value: "Apple" });

    expect(single.contains("Banana", "apple")).toBe(true);
    expect(single.contains("Banana", "nan")).toBe(true);

    const multiple = useComboboxFilter({ locale: "en", multiple: true, value: "Apple" });

    expect(multiple.contains("Banana", "apple")).toBe(false);
    expect(multiple.contains("Banana", "nan")).toBe(true);
  });
});
