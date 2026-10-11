import { afterEach, describe, expect, it } from "vite-plus/test";

import { REASONS } from "../../internals/event-details";
import { MenuStore } from "./MenuStore";

describe("MenuStore instantType selector", () => {
  it("exposes trigger-change while open and hides it once closed", () => {
    const store = new MenuStore({}, "test-id", false);

    store.update({ open: true });
    store.set("instantType", "trigger-change");
    expect(store.peek("instantType")).toBe("trigger-change");

    store.update({ open: false });
    expect(store.peek("instantType")).toBe(undefined);
    // The raw value is untouched; only the selector hides it while closed.
    expect(store.peekState().instantType).toBe("trigger-change");
  });

  it("uses the controlled open state to hide trigger-change", () => {
    const store = new MenuStore({ openProp: true }, "test-id", false);

    store.set("instantType", "trigger-change");
    expect(store.peek("instantType")).toBe("trigger-change");

    // A controlled consumer committing open={false} never passes through setOpen.
    store.update({ openProp: false });
    expect(store.peek("instantType")).toBe(undefined);
  });

  it("keeps other instant types while closed", () => {
    const store = new MenuStore({}, "test-id", false);

    store.set("instantType", "click");
    store.update({ open: false });
    expect(store.peek("instantType")).toBe("click");
  });
});

describe("MenuStore highlight tagging", () => {
  function registryStore() {
    const store = new MenuStore({}, "test-id", false);
    const first = document.createElement("div");
    const second = document.createElement("div");
    store.context.itemDomElements.current = [first, second];
    store.context.itemLabels.current = ["One", "Two"];
    return { store, first, second };
  }

  it("tags index writes with the reason and event for onItemHighlighted", () => {
    const { store } = registryStore();
    const event = new KeyboardEvent("keydown", { key: "ArrowDown" });

    store.setActiveIndex(1, REASONS.keyboard, event);

    expect(store.peek("activeIndex")).toBe(1);
    expect(store.context.highlightReason).toBe(REASONS.keyboard);
    expect(store.context.highlightEvent).toBe(event);
  });

  it("leaves the tag alone on no-op writes", () => {
    const { store } = registryStore();

    store.setActiveIndex(1, REASONS.keyboard);
    store.setActiveIndex(1, REASONS.pointer);

    expect(store.context.highlightReason).toBe(REASONS.keyboard);
    expect(store.context.highlightEvent).toBeUndefined();
  });

  it("reports none when writing back to the reported item", () => {
    const { store, first } = registryStore();
    store.context.reportedItem = first;

    store.setActiveIndex(0, REASONS.pointer);

    expect(store.peek("activeIndex")).toBe(0);
    expect(store.context.highlightReason).toBe(REASONS.none);
    expect(store.context.highlightEvent).toBeUndefined();
  });

  it("highlightItem resolves elements to tagged index writes", () => {
    const { store, second } = registryStore();
    const event = new MouseEvent("mouseenter");

    store.highlightItem(second, REASONS.pointer, event);

    expect(store.peek("activeIndex")).toBe(1);
    expect(store.context.highlightReason).toBe(REASONS.pointer);
    expect(store.context.highlightEvent).toBe(event);
  });

  it("highlightItem ignores elements outside the registry", () => {
    const { store } = registryStore();

    store.highlightItem(document.createElement("div"), REASONS.pointer);

    expect(store.peek("activeIndex")).toBeNull();
    expect(store.context.highlightReason).toBe(REASONS.none);
  });
});
