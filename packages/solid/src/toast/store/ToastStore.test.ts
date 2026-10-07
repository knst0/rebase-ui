import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastStore } from "./ToastStore";

function createStore(options?: { timeout?: number; limit?: number }) {
  return new ToastStore({
    timeout: options?.timeout ?? 5000,
    limit: options?.limit ?? 3,
    viewport: null,
    toasts: [],
    hovering: false,
    focused: false,
    isWindowFocused: true,
    prevFocusElement: null,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastStore", () => {
  it("adds a toast with generated id, starting status and zero update key", () => {
    const store = createStore();
    const id = store.addToast({ title: "Hello" });

    expect(id).toContain("toast-");
    const toast = store.peek("toast", id);
    expect(toast.title).toBe("Hello");
    expect(toast.transitionStatus).toBe("starting");
    expect(toast.updateKey).toBe(0);
    expect(store.peek("isEmpty")).toBe(false);
  });

  it("prepends new toasts so the newest toast is first", () => {
    const store = createStore();
    const first = store.addToast({ title: "first" });
    const second = store.addToast({ title: "second" });

    expect(store.peek("toasts").map((toast: { id: string }) => toast.id)).toEqual([second, first]);
  });

  it("upserts a toast with an existing id instead of adding a duplicate", () => {
    const store = createStore();
    const id = store.addToast({ id: "same", title: "original" });
    const sameId = store.addToast({ id: "same", title: "updated" });

    expect(sameId).toBe(id);
    expect(store.peek("toasts")).toHaveLength(1);
    const toast = store.peek("toast", id);
    expect(toast.title).toBe("updated");
    expect(toast.updateKey).toBe(1);
  });

  it("re-adds a toast whose previous incarnation is ending", () => {
    const store = createStore();
    store.addToast({ id: "retry", title: "original" });
    store.closeToast("retry");

    expect(store.peek("toast", "retry").transitionStatus).toBe("ending");

    store.addToast({ id: "retry", title: "again" });
    const toast = store.peek("toast", "retry");
    expect(toast.transitionStatus).toBe("starting");
    expect(toast.title).toBe("again");
    expect(store.peek("toasts")).toHaveLength(1);
  });

  it("auto-dismisses a toast after its timeout", () => {
    const store = createStore({ timeout: 1000 });
    const onClose = vi.fn();
    const id = store.addToast({ title: "timed", onClose });

    vi.advanceTimersByTime(1000);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(store.peek("toast", id).transitionStatus).toBe("ending");
  });

  it("respects a per-toast timeout over the provider timeout", () => {
    const store = createStore({ timeout: 1000 });
    const id = store.addToast({ title: "slow", timeout: 5000 });

    vi.advanceTimersByTime(1000);
    expect(store.peek("toast", id).transitionStatus).toBe("starting");

    vi.advanceTimersByTime(4000);
    expect(store.peek("toast", id).transitionStatus).toBe("ending");
  });

  it("never auto-dismisses loading toasts or toasts with timeout 0", () => {
    const store = createStore({ timeout: 1000 });
    const loadingId = store.addToast({ title: "loading", type: "loading" });
    const stickyId = store.addToast({ title: "sticky", timeout: 0 });

    vi.advanceTimersByTime(60_000);

    expect(store.peek("toast", loadingId).transitionStatus).toBe("starting");
    expect(store.peek("toast", stickyId).transitionStatus).toBe("starting");
  });

  it("closeToast marks the toast as ending and calls onClose", () => {
    const store = createStore({ timeout: 0 });
    const onClose = vi.fn();
    const id = store.addToast({ title: "bye", onClose });

    store.closeToast(id);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(store.peek("toast", id).transitionStatus).toBe("ending");
  });

  it("closeToast without an id closes every toast", () => {
    const store = createStore({ timeout: 0 });
    const first = store.addToast({ title: "one" });
    const second = store.addToast({ title: "two" });

    store.closeToast();

    expect(store.peek("toast", first).transitionStatus).toBe("ending");
    expect(store.peek("toast", second).transitionStatus).toBe("ending");
  });

  it("removeToast drops the toast and calls onRemove", () => {
    const store = createStore({ timeout: 0 });
    const onRemove = vi.fn();
    const id = store.addToast({ title: "gone", onRemove });

    store.removeToast(id);

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(store.peek("toasts")).toHaveLength(0);
    expect(store.peek("isEmpty")).toBe(true);
  });

  it("ignores unknown toast ids", () => {
    const store = createStore();
    expect(() => {
      store.closeToast("missing");
      store.removeToast("missing");
      store.updateToast("missing", { title: "nope" });
    }).not.toThrow();
  });

  it("marks toasts beyond the limit as limited, newest first", () => {
    const store = createStore({ timeout: 0, limit: 2 });
    store.addToast({ id: "old", title: "old" });
    store.addToast({ id: "mid", title: "mid" });
    store.addToast({ id: "new", title: "new" });

    expect(store.peek("toast", "new").limited).toBe(false);
    expect(store.peek("toast", "mid").limited).toBe(false);
    expect(store.peek("toast", "old").limited).toBe(true);
  });

  it("recomputes limited flags when the limit changes", () => {
    const store = createStore({ timeout: 0, limit: 3 });
    store.addToast({ id: "one", title: "one" });
    store.addToast({ id: "two", title: "two" });

    store.syncProviderProps(5000, 1);

    expect(store.peek("toast", "two").limited).toBe(false);
    expect(store.peek("toast", "one").limited).toBe(true);
  });

  it("ignores updates for toasts that are ending", () => {
    const store = createStore({ timeout: 0 });
    const id = store.addToast({ title: "original" });
    store.closeToast(id);

    store.updateToast(id, { title: "changed" });

    expect(store.peek("toast", id).title).toBe("original");
  });

  it("updateToast supports functional updates", () => {
    const store = createStore({ timeout: 0 });
    const id = store.addToast({ title: "original" });

    store.updateToast(id, (prev) => (prev.title === "original" ? { title: "updated" } : {}));

    expect(store.peek("toast", id).title).toBe("updated");
  });

  it("tracks dom index, visible index and offset for each toast", () => {
    const store = createStore({ timeout: 0 });
    store.addToast({ id: "first", title: "first" });
    store.addToast({ id: "second", title: "second" });
    store.updateToastInternal("first", { height: 40 });
    store.updateToastInternal("second", { height: 30 });

    // Newest toast is first in DOM order.
    expect(store.peek("toastIndex", "second")).toBe(0);
    expect(store.peek("toastIndex", "first")).toBe(1);
    expect(store.peek("toastVisibleIndex", "second")).toBe(0);
    expect(store.peek("toastVisibleIndex", "first")).toBe(1);
    expect(store.peek("toastOffsetY", "second")).toBe(0);
    expect(store.peek("toastOffsetY", "first")).toBe(30);
  });

  it("reports expanded while hovering or focused", () => {
    const store = createStore();
    expect(store.peek("expanded")).toBe(false);

    store.set("hovering", true);
    expect(store.peek("expanded")).toBe(true);

    store.set("hovering", false);
    store.set("focused", true);
    expect(store.peek("expanded")).toBe(true);
  });

  it("pauses timers while expanded and resumes them afterwards", () => {
    const store = createStore({ timeout: 1000 });
    const id = store.addToast({ title: "pausable" });

    store.pauseTimers();
    vi.advanceTimersByTime(5000);
    expect(store.peek("toast", id).transitionStatus).toBe("starting");

    store.resumeTimers();
    vi.advanceTimersByTime(1000);
    expect(store.peek("toast", id).transitionStatus).toBe("ending");
  });

  it("resolves a promise toast to success and error states", async () => {
    const store = createStore({ timeout: 0 });
    let resolvePromise!: (value: string) => void;
    let rejectPromise!: (reason: Error) => void;
    const success = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });
    const failure = new Promise<string>((_, reject) => {
      rejectPromise = reject;
    });

    const handledSuccess = store.promiseToast(success, {
      loading: "Working",
      success: "Done",
      error: "Failed",
    });
    const successId = store.peek("toasts")[0].id;
    expect(store.peek("toast", successId).type).toBe("loading");

    const handledFailure = store.promiseToast(failure, {
      loading: "Working",
      success: "Done",
      error: (error: Error) => `Failed: ${error.message}`,
    });
    const failureId = store.peek("toasts")[0].id;
    expect(store.peek("toast", failureId).type).toBe("loading");

    resolvePromise("ok");
    await expect(handledSuccess).resolves.toBe("ok");
    const successToast = store.peek("toast", successId);
    expect(successToast.type).toBe("success");
    expect(successToast.description).toBe("Done");

    rejectPromise(new Error("boom"));
    await expect(handledFailure).rejects.toThrow("boom");
    const errorToast = store.peek("toast", failureId);
    expect(errorToast.type).toBe("error");
    expect(errorToast.description).toBe("Failed: boom");
  });

  it("dispose clears pending timers", () => {
    const store = createStore({ timeout: 1000 });
    const id = store.addToast({ title: "disposed" });

    store.dispose();
    vi.advanceTimersByTime(5000);

    expect(store.peek("toast", id).transitionStatus).toBe("starting");
  });
});
