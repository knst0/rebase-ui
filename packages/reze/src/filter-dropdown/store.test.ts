import { untrack } from "reze-js";
import { describe, expect, it } from "vite-plus/test";

import { DETACHED_OWNER, FilterDropdownStore } from "./store";

describe("FilterDropdownStore", () => {
  it("reports empty only when nothing registered without a query", () => {
    const store = new FilterDropdownStore();

    // One-shot reads: the assertions below consume the values without tracking.
    expect(untrack(store.isEmpty)).toBe(true);

    store.set("registeredItemCount", 2);
    expect(untrack(store.isEmpty)).toBe(false);

    store.set("visibleItemIds", new Set());
    expect(untrack(store.isEmpty)).toBe(true);

    const id = Symbol("item");
    store.set("visibleItemIds", new Set([id]));
    expect(untrack(store.isEmpty)).toBe(false);
    expect(untrack(() => store.isItemVisible(id))).toBe(true);
    expect(untrack(() => store.isItemVisible(Symbol("other")))).toBe(false);

    store.set("visibleItemIds", null);
    expect(untrack(() => store.isItemVisible(Symbol("other")))).toBe(true);
  });

  it("DETACHED_OWNER keeps every item visible", () => {
    expect(untrack(() => DETACHED_OWNER.store.isItemVisible(Symbol("item")))).toBe(true);
    expect(typeof DETACHED_OWNER.registerItem(Symbol("item"), { getText: () => "x" })).toBe("function");
  });
});
