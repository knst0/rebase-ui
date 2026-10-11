import { describe, expect, it } from "vite-plus/test";

import { PopoverStore } from "./PopoverStore";

describe("PopoverStore instantType selector", () => {
  it("exposes trigger-change while open and hides it once closed", () => {
    const store = new PopoverStore({}, "test-id", false);

    store.update({ open: true });
    store.set("instantType", "trigger-change");
    expect(store.peek("instantType")).toBe("trigger-change");

    store.update({ open: false });
    expect(store.peek("instantType")).toBe(undefined);
    // The raw value is untouched; only the selector hides it while closed.
    expect(store.peekState().instantType).toBe("trigger-change");
  });

  it("uses the controlled open state to hide trigger-change", () => {
    const store = new PopoverStore({ openProp: true }, "test-id", false);

    store.set("instantType", "trigger-change");
    expect(store.peek("instantType")).toBe("trigger-change");

    // A controlled consumer committing open={false} never passes through setOpen.
    store.update({ openProp: false });
    expect(store.peek("instantType")).toBe(undefined);
  });

  it("keeps other instant types while closed", () => {
    const store = new PopoverStore({}, "test-id", false);

    store.set("instantType", "focus");
    store.update({ open: false });
    expect(store.peek("instantType")).toBe("focus");
  });
});
