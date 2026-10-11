import { cleanup, mount, tick } from "@rezejs/testing-library";
import { effect } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { FloatingRootStore } from "../../internals/floating/tree/FloatingRootStore";
import { PopupTriggerMap } from "../../internals/floating/triggerMap";
import { createInitialSelectStoreContext, createInitialSelectStoreState, SelectStore, type SelectStoreState } from "./SelectStore";

afterEach(cleanup);

function createTestStore(overrides: Partial<SelectStoreState> = {}): SelectStore {
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

  return new SelectStore(createInitialSelectStoreState({ floatingRootContext, ...overrides }), {
    ...createInitialSelectStoreContext(),
    setValue: () => {},
    setOpen: () => {},
    handleScrollArrowVisibility: () => {},
    onOpenChangeComplete: () => {},
  });
}

describe("SelectStore", () => {
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
        store.select("value");
        valueRuns += 1;
      });
      return null;
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

    store.set("value", "a");
    tick();
    expect(openRuns).toBe(2);
    expect(valueRuns).toBe(2);
  });

  it("reads the synchronous snapshot through peek without subscribing", () => {
    const store = createTestStore({ value: "a" });

    let runs = 0;
    mount(() => {
      effect(() => {
        store.peek("value");
        runs += 1;
      });
      return null;
    });
    tick();
    expect(runs).toBe(1);

    store.set("value", "b");
    tick();
    expect(runs).toBe(1);
    expect(store.peek("value")).toBe("b");
  });

  it("matches single values by identity through isSelected", () => {
    const store = createTestStore({ value: "a" });

    expect(store.peek("isSelected", "a")).toBe(true);
    expect(store.peek("isSelected", "b")).toBe(false);
    expect(store.peek("isSelected", null)).toBe(false);

    store.set("value", null);
    expect(store.peek("isSelected", null)).toBe(true);
  });

  it("matches any included value in multiple mode through isSelected", () => {
    const store = createTestStore({ multiple: true, value: ["a", "b"] });

    expect(store.peek("isSelected", "a")).toBe(true);
    expect(store.peek("isSelected", "b")).toBe(true);
    expect(store.peek("isSelected", "c")).toBe(false);
  });

  it("compares object values with a custom isItemEqualToValue through isSelected", () => {
    const store = createTestStore({
      value: { id: 1, label: "One" },
      isItemEqualToValue: (itemValue, selectedValue) => itemValue?.id === selectedValue?.id,
    });

    expect(store.peek("isSelected", { id: 1, label: "Changed" })).toBe(true);
    expect(store.peek("isSelected", { id: 2, label: "Two" })).toBe(false);
  });

  it("treats the value (not a stale selectedIndex) as the source of truth", () => {
    const store = createTestStore({ value: "a", selectedIndex: 0 });

    store.set("value", "b");
    expect(store.peek("isSelected", "a")).toBe(false);
    expect(store.peek("isSelected", "b")).toBe(true);
  });

  it("compares indices through isActive and isSelectedByFocus", () => {
    const store = createTestStore({ activeIndex: 1, selectedIndex: 2 });

    expect(store.peek("isActive", 1)).toBe(true);
    expect(store.peek("isActive", 0)).toBe(false);
    expect(store.peek("isSelectedByFocus", 2)).toBe(true);
    expect(store.peek("isSelectedByFocus", 1)).toBe(false);
  });

  it("reports hasSelectedValue for null, empty, and multiple values", () => {
    const nullStore = createTestStore({ value: null });
    expect(nullStore.peek("hasSelectedValue")).toBe(false);

    const emptyStore = createTestStore({ value: "" });
    expect(emptyStore.peek("hasSelectedValue")).toBe(false);

    const filledStore = createTestStore({ value: "a" });
    expect(filledStore.peek("hasSelectedValue")).toBe(true);

    const emptyMultipleStore = createTestStore({ multiple: true, value: [] });
    expect(emptyMultipleStore.peek("hasSelectedValue")).toBe(false);

    const filledMultipleStore = createTestStore({ multiple: true, value: ["a"] });
    expect(filledMultipleStore.peek("hasSelectedValue")).toBe(true);
  });

  it("detects null-item labels through hasNullItemLabel", () => {
    const recordStore = createTestStore({ items: { null: "None" } as never });
    expect(recordStore.peek("hasNullItemLabel", true)).toBe(true);
    expect(recordStore.peek("hasNullItemLabel", false)).toBe(false);

    const arrayStore = createTestStore({
      items: [{ label: "None", value: null }] as never,
    });
    expect(arrayStore.peek("hasNullItemLabel", true)).toBe(true);

    const plainStore = createTestStore({
      items: [{ label: "One", value: "one" }] as never,
    });
    expect(plainStore.peek("hasNullItemLabel", true)).toBe(false);

    const groupedStore = createTestStore({
      items: [{ items: [{ label: "None", value: null }] }] as never,
    });
    expect(groupedStore.peek("hasNullItemLabel", true)).toBe(true);
  });
});
