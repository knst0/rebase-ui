import { describe, expect, it, vi } from "vite-plus/test";

import { MenuStore } from "./MenuStore";

// jsdom's user agent contains `AppleWebKit`, so the real detector reports a
// WebKit engine here. Pin it off: this file covers the non-WebKit path (see
// `MenuStoreFilter.webkit.test.ts` for the WebKit path).
vi.mock("../../internals/utils/platform", async () => {
  const actual = await vi.importActual<typeof import("../../internals/utils/platform")>("../../internals/utils/platform");

  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, webkit: false },
    },
  };
});

describe("MenuStore filter state", () => {
  it("initializes filter fields to their empty state", () => {
    const store = new MenuStore({}, "test-id", false);

    expect(store.peek("keyboardOpen")).toBe(false);
    expect(store.peek("listElement")).toBeNull();
    expect(store.peek("filterTriggerProps")).toEqual({});
    expect(store.peek("inputProps")).toEqual({});
    expect(store.peek("inputFocused")).toBe(false);
    expect(store.peek("highlightedItem")).toBeUndefined();
    expect(store.peek("highlightedItemId")).toBeUndefined();
  });

  it("points the trigger at the list once one holds the menu role", () => {
    const store = new MenuStore({}, "test-id", false);

    // Without an open popup there is nothing to control.
    expect(store.peek("triggerControlsId", "trigger")).toBeUndefined();

    store.update({ open: true });
    store.set("activeTriggerId", "trigger");
    const popup = document.createElement("div");
    popup.id = "test-popup";
    store.set("popupElement", popup);
    const list = document.createElement("div");
    list.id = "test-list";
    store.set("listElement", list);
    expect(store.peek("triggerControlsId", "trigger")).toBe("test-list");
  });

  it("exposes WebKit selection state only while the input has focus", () => {
    const store = new MenuStore({}, "test-id", false);

    // Outside WebKit the attribute is never exposed.
    store.set("inputFocused", true);
    expect(store.peek("webkitAriaSelected", true)).toBeUndefined();

    store.set("inputFocused", false);
    expect(store.peek("webkitAriaSelected", true)).toBeUndefined();
    expect(store.peek("webkitAriaSelected", false)).toBeUndefined();
  });

  it("writes the active index once per change", () => {
    const store = new MenuStore({}, "test-id", false);

    expect(store.peek("activeIndex")).toBeNull();
    store.setActiveIndex(2);
    expect(store.peek("activeIndex")).toBe(2);
    store.setActiveIndex(2);
    expect(store.peek("activeIndex")).toBe(2);
    store.setActiveIndex(null);
    expect(store.peek("activeIndex")).toBeNull();
  });
});
