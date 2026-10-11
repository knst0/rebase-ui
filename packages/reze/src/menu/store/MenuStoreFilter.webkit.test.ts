import { describe, expect, it, vi } from "vite-plus/test";

import { MenuStore } from "./MenuStore";

// Upstream #5868: `aria-selected` is invalid on `menuitem`, but Safari
// VoiceOver needs it for arrow-key navigation. Expose it only on WebKit
// while the filter input has focus.
vi.mock("../../internals/utils/platform", async () => {
  const actual = await vi.importActual<typeof import("../../internals/utils/platform")>("../../internals/utils/platform");

  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, webkit: true },
    },
  };
});

describe("MenuStore filter state (WebKit)", () => {
  it("exposes selection state only while the input has focus", () => {
    const store = new MenuStore({}, "test-id", false);

    store.set("inputFocused", true);
    expect(store.peek("webkitAriaSelected", true)).toBe(true);
    expect(store.peek("webkitAriaSelected", false)).toBeUndefined();

    store.set("inputFocused", false);
    expect(store.peek("webkitAriaSelected", true)).toBeUndefined();
    expect(store.peek("webkitAriaSelected", false)).toBeUndefined();
  });
});
