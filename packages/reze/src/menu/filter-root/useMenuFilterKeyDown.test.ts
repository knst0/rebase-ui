import { afterEach, describe, expect, it } from "vite-plus/test";

import { getMenuFilterKeyAction, type MenuFilterKeyAction, type MenuFilterKeyContext } from "./useMenuFilterKeyDown";

function action(key: string, context: Partial<MenuFilterKeyContext> & { modifiers?: string[] } = {}): MenuFilterKeyAction {
  const { modifiers = [], ...rest } = context;
  return getMenuFilterKeyAction(
    {
      key,
      shiftKey: modifiers.includes("shift"),
      ctrlKey: modifiers.includes("ctrl"),
      altKey: modifiers.includes("alt"),
      metaKey: modifiers.includes("meta"),
    },
    {
      orientation: "vertical",
      rtl: false,
      hasActiveItem: false,
      activeItemOpensSubmenu: false,
      hasValue: false,
      ...rest,
    },
  );
}

describe("getMenuFilterKeyAction", () => {
  it("routes text editing to the input", () => {
    expect(action("a")).toBe("edit");
    expect(action("ArrowLeft", { hasValue: true })).toBe("edit");
    expect(action("Home", { hasValue: true })).toBe("edit");
    expect(action("ArrowRight", { modifiers: ["shift"] })).toBe("edit");
  });

  it("routes list navigation", () => {
    expect(action("ArrowDown")).toBe("navigate");
    expect(action("ArrowUp", { hasActiveItem: true })).toBe("navigate");
    expect(action("Home", { hasActiveItem: true })).toBe("navigate");
    expect(action("PageDown")).toBe("navigate");
  });

  it("activates the highlighted item on Enter", () => {
    expect(action("Enter", { hasActiveItem: true })).toBe("activate");
    expect(action("Enter")).toBe("navigate");
  });

  it("hands cross-axis keys to a highlighted submenu trigger", () => {
    expect(action("ArrowRight", { hasActiveItem: true, activeItemOpensSubmenu: true })).toBe("submenu");
    expect(action("ArrowRight", { hasValue: true })).toBe("edit");
  });

  it("enters a horizontal list with a vertical arrow", () => {
    expect(action("ArrowDown", { orientation: "horizontal" })).toBe("enter-list");
    expect(action("ArrowRight", { orientation: "horizontal", hasValue: true })).toBe("edit");
    expect(action("ArrowDown", { orientation: "horizontal", hasActiveItem: true })).toBe("navigate");
  });

  it("closes on Shift+Tab and ignores Tab and IME keys", () => {
    expect(action("Tab", { modifiers: ["shift"] })).toBe("close");
    expect(action("Tab")).toBe("ignore");
    expect(
      getMenuFilterKeyAction(
        { key: "Enter", which: 229, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false },
        { orientation: "vertical", rtl: false, hasActiveItem: true, activeItemOpensSubmenu: false, hasValue: false },
      ),
    ).toBe("ignore");
  });
});
