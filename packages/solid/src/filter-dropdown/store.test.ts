import { createRoot, flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { DETACHED_OWNER, FilterDropdownStore } from "./store";

describe("FilterDropdownStore", () => {
  it("reports empty only when nothing registered without a query", () => {
    createRoot((dispose) => {
      const store = new FilterDropdownStore();
      flush();
      expect(store.isEmpty()).toBe(true);

      store.set("registeredItemCount", 2);
      flush();
      expect(store.isEmpty()).toBe(false);

      store.set("visibleItemIds", new Set());
      flush();
      expect(store.isEmpty()).toBe(true);

      const id = Symbol("item");
      store.set("visibleItemIds", new Set([id]));
      flush();
      expect(store.isEmpty()).toBe(false);
      expect(store.isItemVisible(id)).toBe(true);
      expect(store.isItemVisible(Symbol("other"))).toBe(false);

      store.set("visibleItemIds", null);
      flush();
      expect(store.isItemVisible(Symbol("other"))).toBe(true);
      dispose();
    });
    flush();
  });

  it("DETACHED_OWNER keeps every item visible", () => {
    createRoot((dispose) => {
      flush();
      expect(DETACHED_OWNER.store.isItemVisible(Symbol("item"))).toBe(true);
      expect(typeof DETACHED_OWNER.registerItem(Symbol("item"), { getText: () => "x" })).toBe("function");
      dispose();
    });
    flush();
  });
});
