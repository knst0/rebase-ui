import { cleanup, mount, tick } from "@rezejs/testing-library";
import { effect, type JSX } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { FloatingRootStore } from "../../internals/floating/tree/FloatingRootStore";
import { PopupTriggerMap } from "../../internals/floating/triggerMap";
import {
  createInitialComboboxStoreContext,
  createInitialComboboxStoreState,
  ComboboxStore,
  type ComboboxStoreState,
} from "./ComboboxStore";

afterEach(cleanup);

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
  it("select subscribes only to the fields its selector reads", () => {
    const store = createTestStore();

    let openRuns = 0;
    let valueRuns = 0;
    mount(() => {
      effect(() => {
        store.select("open");
        openRuns += 1;
      });
      effect(() => {
        store.select("selectedValue");
        valueRuns += 1;
      });
      return null as unknown as JSX.Element;
    });
    tick();
    expect(openRuns).toBe(1);
    expect(valueRuns).toBe(1);

    // Unrelated writes wake neither computation (a single shared version
    // signal would re-run every subscriber on every write).
    store.set("activeIndex", 0);
    tick();
    expect(openRuns).toBe(1);
    expect(valueRuns).toBe(1);

    store.set("open", true);
    tick();
    expect(openRuns).toBe(2);
    expect(valueRuns).toBe(1);

    store.set("selectedValue", "b");
    tick();
    expect(openRuns).toBe(2);
    expect(valueRuns).toBe(2);
  });

  it("reads the synchronous snapshot through peek without subscribing", () => {
    const store = createTestStore({ selectedValue: "a" });

    let runs = 0;
    mount(() => {
      effect(() => {
        store.peek("selectedValue");
        runs += 1;
      });
      return null as unknown as JSX.Element;
    });
    tick();
    expect(runs).toBe(1);

    store.set("selectedValue", "b");
    tick();
    expect(runs).toBe(1);
    expect(store.peek("selectedValue")).toBe("b");
  });

  it("applies synchronous writes observably through update", () => {
    const store = createTestStore();

    store.update({ open: true, activeIndex: 2 });
    expect(store.peek("open")).toBe(true);
    expect(store.peek("activeIndex")).toBe(2);
    expect(store.peek("isActive", 2)).toBe(true);
  });

  it("matches single values by identity through isSelected", () => {
    const store = createTestStore({ selectedValue: "a" });

    expect(store.peek("isSelected", "a")).toBe(true);
    expect(store.peek("isSelected", "b")).toBe(false);
    expect(store.peek("isSelected", null)).toBe(false);

    store.set("selectedValue", null);
    expect(store.peek("isSelected", null)).toBe(true);
  });

  it("matches any included value in multiple mode through isSelected", () => {
    const store = createTestStore({ selectionMode: "multiple", selectedValue: ["a", "b"] });

    expect(store.peek("isSelected", "a")).toBe(true);
    expect(store.peek("isSelected", "b")).toBe(true);
    expect(store.peek("isSelected", "c")).toBe(false);
  });

  it("compares object values with a custom isItemEqualToValue through isSelected", () => {
    const store = createTestStore({
      selectedValue: { id: 1, label: "One" },
      isItemEqualToValue: (itemValue, selectedValue) => itemValue?.id === selectedValue?.id,
    });

    expect(store.peek("isSelected", { id: 1, label: "Changed" })).toBe(true);
    expect(store.peek("isSelected", { id: 2, label: "Two" })).toBe(false);
  });

  it("compares indices through isActive", () => {
    const store = createTestStore({ activeIndex: 1 });

    expect(store.peek("isActive", 1)).toBe(true);
    expect(store.peek("isActive", 0)).toBe(false);
  });

  it("reports hasSelectedValue for null and single/multiple values", () => {
    expect(createTestStore({ selectedValue: null }).peek("hasSelectedValue")).toBe(false);

    expect(createTestStore({ selectedValue: "a" }).peek("hasSelectedValue")).toBe(true);

    expect(createTestStore({ selectionMode: "multiple", selectedValue: [] }).peek("hasSelectedValue")).toBe(false);
    expect(createTestStore({ selectionMode: "multiple", selectedValue: ["a"] }).peek("hasSelectedValue")).toBe(true);
  });

  it("reports hasSelectionChips only for non-empty arrays", () => {
    expect(createTestStore({ selectedValue: null }).peek("hasSelectionChips")).toBe(false);
    expect(createTestStore({ selectedValue: "a" }).peek("hasSelectionChips")).toBe(false);
    expect(createTestStore({ selectedValue: [] }).peek("hasSelectionChips")).toBe(false);
    expect(createTestStore({ selectedValue: ["a"] }).peek("hasSelectionChips")).toBe(true);
  });

  it("detects null-item labels through hasNullItemLabel", () => {
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
  });

  it("exposes the floating root context through its selector", () => {
    const store = createTestStore();

    expect(store.peek("floatingRootContext")).toBe(store.peekState().floatingRootContext);
  });
});
