import { describe, expect, it, vi } from "vitest";

import type { ComboboxStore } from "../store/ComboboxStore";
import { clickHighlightedItem, getChipNavigationKeys, getIndexAfterChipRemoval } from "./parts";

describe("Combobox part utilities", () => {
  it("returns no index after removing the only chip", () => {
    expect(getIndexAfterChipRemoval(0, 1)).toBe(undefined);
  });

  it("returns the previous index after removing the last chip", () => {
    expect(getIndexAfterChipRemoval(2, 3)).toBe(1);
  });

  it("keeps the index after removing a chip that is not last", () => {
    expect(getIndexAfterChipRemoval(0, 3)).toBe(0);
  });

  it("maps chip navigation keys in LTR mode", () => {
    expect(getChipNavigationKeys("ltr")).toEqual(["ArrowLeft", "ArrowRight"]);
  });

  it("mirrors chip navigation keys in RTL mode", () => {
    expect(getChipNavigationKeys("rtl")).toEqual(["ArrowRight", "ArrowLeft"]);
  });

  it("does nothing when the highlighted item is not rendered", () => {
    const nativeEvent = new KeyboardEvent("keydown", { key: "Enter" });
    const store = {
      context: {
        listRef: { current: [] },
        selectionEventRef: { current: null },
      },
    } as unknown as ComboboxStore;

    clickHighlightedItem(store, 1, nativeEvent);

    expect(store.context.selectionEventRef.current).toBe(null);
  });

  it("clicks the rendered highlighted item with the originating event", () => {
    const click = vi.fn();
    const nativeEvent = new KeyboardEvent("keydown", { key: "Enter" });
    let selectionEventAtClick: Event | null = null;
    const store = {
      context: {
        listRef: { current: [{ click }] },
        selectionEventRef: { current: null },
      },
    } as unknown as ComboboxStore;
    click.mockImplementation(() => {
      selectionEventAtClick = store.context.selectionEventRef.current;
    });

    clickHighlightedItem(store, 0, nativeEvent);

    expect(click).toHaveBeenCalledOnce();
    expect(selectionEventAtClick).toBe(nativeEvent);
    expect(store.context.selectionEventRef.current).toBe(null);
  });
});
