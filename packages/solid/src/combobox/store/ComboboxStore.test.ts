import { createEffect, createRoot, flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { FloatingRootStore } from "../../internals/floating/tree/FloatingRootStore";
import { PopupTriggerMap } from "../../internals/floating/triggerMap";
import {
  createInitialComboboxStoreContext,
  createInitialComboboxStoreState,
  ComboboxStore,
  type ComboboxStoreState,
} from "./ComboboxStore";

function createTestStore(overrides: Partial<ComboboxStoreState> = {}): ComboboxStore {
  const floatingRootContext = new FloatingRootStore({
    open: false,
    transitionStatus: undefined,
    referenceElement: null,
    floatingElement: null,
    triggerElements: new PopupTriggerMap(),
    floatingId: "test-floating-id",
    syncOnly: true,
    nested: false,
    onOpenChange: undefined,
  });

  return new ComboboxStore(createInitialComboboxStoreState({ floatingRootContext, ...overrides }), {
    ...createInitialComboboxStoreContext(),
    setOpen: () => {},
    setInputValue: () => {},
    setSelectedValue: () => {},
    setIndices: () => {},
    forceMount: () => {},
    handleSelection: () => {},
    requestSubmit: () => {},
    onOpenChangeComplete: () => {},
  });
}

describe("ComboboxStore", () => {
  it("select subscribes only to the fields its selector reads", () =>
    createRoot((dispose) => {
      const store = createTestStore();

      let openRuns = 0;
      let valueRuns = 0;
      createEffect(
        () => store.select("open"),
        () => {
          openRuns += 1;
        },
      );
      createEffect(
        () => store.select("selectedValue"),
        () => {
          valueRuns += 1;
        },
      );
      flush();
      expect(openRuns).toBe(1);
      expect(valueRuns).toBe(1);

      // Unrelated writes wake neither computation (a single shared version
      // signal would re-run every subscriber on every write).
      store.set("activeIndex", 0);
      flush();
      expect(openRuns).toBe(1);
      expect(valueRuns).toBe(1);

      store.set("open", true);
      flush();
      expect(openRuns).toBe(2);
      expect(valueRuns).toBe(1);

      store.set("selectedValue", "a");
      flush();
      expect(openRuns).toBe(2);
      expect(valueRuns).toBe(2);

      dispose();
    }));

  it("reads the synchronous snapshot through peek without subscribing", () =>
    createRoot((dispose) => {
      const store = createTestStore({ selectedValue: "a" });

      let runs = 0;
      createEffect(
        () => store.peek("selectedValue"),
        () => {
          runs += 1;
        },
      );
      flush();
      expect(runs).toBe(1);

      store.set("selectedValue", "b");
      flush();
      expect(runs).toBe(1);
      expect(store.peek("selectedValue")).toBe("b");

      dispose();
    }));

  it("applies synchronous writes observably through update", () =>
    createRoot((dispose) => {
      const store = createTestStore();

      store.update({ open: true, activeIndex: 2 });
      expect(store.peek("open")).toBe(true);
      expect(store.peek("activeIndex")).toBe(2);
      expect(store.peek("isActive", 2)).toBe(true);

      dispose();
    }));

  it("matches single values by identity through isSelected", () =>
    createRoot((dispose) => {
      const store = createTestStore({ selectedValue: "a" });

      expect(store.peek("isSelected", "a")).toBe(true);
      expect(store.peek("isSelected", "b")).toBe(false);
      expect(store.peek("isSelected", null)).toBe(false);

      store.set("selectedValue", null);
      expect(store.peek("isSelected", null)).toBe(true);

      dispose();
    }));

  it("matches any included value in multiple mode through isSelected", () =>
    createRoot((dispose) => {
      const store = createTestStore({ selectionMode: "multiple", selectedValue: ["a", "b"] });

      expect(store.peek("isSelected", "a")).toBe(true);
      expect(store.peek("isSelected", "b")).toBe(true);
      expect(store.peek("isSelected", "c")).toBe(false);

      dispose();
    }));

  it("compares object values with a custom isItemEqualToValue through isSelected", () =>
    createRoot((dispose) => {
      const store = createTestStore({
        selectedValue: { id: 1, label: "One" },
        isItemEqualToValue: (itemValue, selectedValue) => itemValue?.id === selectedValue?.id,
      });

      expect(store.peek("isSelected", { id: 1, label: "Changed" })).toBe(true);
      expect(store.peek("isSelected", { id: 2, label: "Two" })).toBe(false);

      dispose();
    }));

  it("compares indices through isActive", () =>
    createRoot((dispose) => {
      const store = createTestStore({ activeIndex: 1 });

      expect(store.peek("isActive", 1)).toBe(true);
      expect(store.peek("isActive", 0)).toBe(false);

      dispose();
    }));

  it("reports hasSelectedValue for null and single/multiple values", () =>
    createRoot((dispose) => {
      expect(createTestStore({ selectedValue: null }).peek("hasSelectedValue")).toBe(false);

      expect(createTestStore({ selectedValue: "a" }).peek("hasSelectedValue")).toBe(true);

      expect(createTestStore({ selectionMode: "multiple", selectedValue: [] }).peek("hasSelectedValue")).toBe(false);
      expect(createTestStore({ selectionMode: "multiple", selectedValue: ["a"] }).peek("hasSelectedValue")).toBe(true);

      dispose();
    }));

  it("reports hasSelectionChips only for non-empty arrays", () =>
    createRoot((dispose) => {
      expect(createTestStore({ selectedValue: null }).peek("hasSelectionChips")).toBe(false);
      expect(createTestStore({ selectedValue: "a" }).peek("hasSelectionChips")).toBe(false);
      expect(createTestStore({ selectedValue: [] }).peek("hasSelectionChips")).toBe(false);
      expect(createTestStore({ selectedValue: ["a"] }).peek("hasSelectionChips")).toBe(true);

      dispose();
    }));

  it("detects null-item labels through hasNullItemLabel", () =>
    createRoot((dispose) => {
      const arrayStore = createTestStore({
        items: [{ label: "None", value: null }] as never,
      });
      expect(arrayStore.peek("hasNullItemLabel", true)).toBe(true);
      expect(arrayStore.peek("hasNullItemLabel", false)).toBe(false);

      const plainStore = createTestStore({
        items: [{ label: "One", value: "one" }] as never,
      });
      expect(plainStore.peek("hasNullItemLabel", true)).toBe(false);

      const groupedStore = createTestStore({
        items: [{ items: [{ label: "None", value: null }] }] as never,
      });
      expect(groupedStore.peek("hasNullItemLabel", true)).toBe(true);

      dispose();
    }));

  it("exposes the floating root context through its selector", () =>
    createRoot((dispose) => {
      const store = createTestStore();

      expect(store.peek("floatingRootContext")).toBe(store.peekState().floatingRootContext);

      dispose();
    }));
});
