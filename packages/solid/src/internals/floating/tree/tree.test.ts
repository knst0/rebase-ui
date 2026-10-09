import { createEffect, createRoot, flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import type { FloatingNodeType } from "../types";
import { getEmptyRootContext } from "../utils/getEmptyRootContext";
import { FloatingRootStore } from "./FloatingRootStore";
import { FloatingTreeStore } from "./FloatingTreeStore";

function createStore(overrides: Partial<ConstructorParameters<typeof FloatingRootStore>[0]> = {}) {
  return new FloatingRootStore({
    open: false,
    transitionStatus: undefined,
    referenceElement: null,
    floatingElement: null,
    triggerElements: getEmptyRootContext().triggerElements,
    floatingId: undefined,
    syncOnly: false,
    nested: false,
    onOpenChange: undefined,
    ...overrides,
  });
}

function openDetails() {
  return createChangeEventDetails(REASONS.triggerPress, new MouseEvent("click"));
}

describe("FloatingTreeStore", () => {
  it("adds nodes and removes them by identity", () => {
    const store = new FloatingTreeStore();
    const first: FloatingNodeType = { id: "first", parentId: null };
    const second: FloatingNodeType = { id: "second", parentId: "first" };

    store.addNode(first);
    store.addNode(second);
    expect(store.nodesRef.current).toEqual([first, second]);

    store.removeNode(first);
    expect(store.nodesRef.current).toEqual([second]);
  });

  it("ignores removing a node that was never added", () => {
    const store = new FloatingTreeStore();
    const node: FloatingNodeType = { id: "only", parentId: null };
    store.addNode(node);

    store.removeNode({ id: "only", parentId: null });
    expect(store.nodesRef.current).toEqual([node]);
  });

  it("emits through its event emitter", () => {
    const store = new FloatingTreeStore();
    const listener = vi.fn();
    store.events.on("test", listener);
    store.events.emit("test", { value: 1 });
    expect(listener).toHaveBeenCalledWith({ value: 1 });
  });
});

describe("FloatingRootStore", () => {
  it("dispatches open changes through the emitter and onOpenChange", () => {
    const onOpenChange = vi.fn();
    const listener = vi.fn();
    const store = createStore({ onOpenChange });
    store.context.events.on("openchange", listener);

    store.setOpen(true, openDetails());

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ open: true, reason: REASONS.triggerPress, nested: false }));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it("forwards without emitting in syncOnly mode", () => {
    const onOpenChange = vi.fn();
    const listener = vi.fn();
    const store = createStore({ syncOnly: true, onOpenChange });
    store.context.events.on("openchange", listener);

    store.setOpen(true, openDetails());

    expect(listener).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it("keeps a hover openEvent but lets click-like events upgrade it", () => {
    const store = createStore();
    store.updateState({ open: true });

    const hoverEvent = new MouseEvent("mousemove");
    store.syncOpenEvent(true, hoverEvent);
    expect(store.context.dataRef.current.openEvent).toBe(undefined);

    const clickEvent = new MouseEvent("mousedown");
    store.syncOpenEvent(true, clickEvent);
    expect(store.context.dataRef.current.openEvent).toBe(clickEvent);

    store.syncOpenEvent(false, undefined);
    expect(store.context.dataRef.current.openEvent).toBe(undefined);
  });

  it("resolves the referenceElement selector from positionReference first", () => {
    const reference = document.createElement("button");
    const position = document.createElement("div");
    const store = createStore({ referenceElement: reference });

    expect(store.select("referenceElement")).toBe(reference);

    store.updateState({ positionReference: position });
    expect(store.select("referenceElement")).toBe(position);
    expect(store.useState("referenceElement")()).toBe(position);
    expect(store.useState("open")()).toBe(false);
  });

  it("peek mirrors select without subscribing", () =>
    createRoot((dispose) => {
      const reference = document.createElement("button");
      const position = document.createElement("div");
      const store = createStore({ referenceElement: reference });

      // Same values and selector semantics as the tracked read.
      expect(store.peek("open")).toBe(store.select("open"));
      expect(store.peek("referenceElement")).toBe(reference);
      store.updateState({ positionReference: position });
      expect(store.peek("referenceElement")).toBe(position);
      expect(store.peekState().open).toBe(store.select("open"));

      // A computation reading `peek` does not re-run on updates, while one
      // reading `select` does. One-shot handler reads must use `peek` so they
      // never trigger STRICT_READ_UNTRACKED in effect apply scopes.
      let selectRuns = 0;
      let peekRuns = 0;
      createEffect(
        () => store.select("open"),
        () => {
          selectRuns += 1;
        },
      );
      createEffect(
        () => store.peek("open"),
        () => {
          peekRuns += 1;
        },
      );
      flush();
      expect(selectRuns).toBe(1);
      expect(peekRuns).toBe(1);

      store.updateState({ open: true });
      flush();
      expect(store.peek("open")).toBe(true);
      expect(selectRuns).toBe(2);
      expect(peekRuns).toBe(1);

      dispose();
    }));

  it("select subscribes only to the fields it reads", () =>
    createRoot((dispose) => {
      const store = createStore();
      let openRuns = 0;
      let floatingIdRuns = 0;
      let referenceRuns = 0;
      createEffect(
        () => store.select("open"),
        () => {
          openRuns += 1;
        },
      );
      createEffect(
        () => store.select("floatingId"),
        () => {
          floatingIdRuns += 1;
        },
      );
      createEffect(
        () => store.select("referenceElement"),
        () => {
          referenceRuns += 1;
        },
      );
      flush();
      expect(openRuns).toBe(1);
      expect(floatingIdRuns).toBe(1);
      expect(referenceRuns).toBe(1);

      // An unrelated key change wakes no one.
      store.updateState({ transitionStatus: "starting" });
      flush();
      expect(openRuns).toBe(1);
      expect(floatingIdRuns).toBe(1);
      expect(referenceRuns).toBe(1);

      // The derived `referenceElement` selector subscribes to both
      // `positionReference` and `referenceElement`.
      const position = document.createElement("div");
      store.updateState({ positionReference: position });
      flush();
      expect(referenceRuns).toBe(2);
      expect(openRuns).toBe(1);
      expect(floatingIdRuns).toBe(1);

      store.updateState({ open: true });
      flush();
      expect(openRuns).toBe(2);
      expect(referenceRuns).toBe(2);
      expect(floatingIdRuns).toBe(1);

      dispose();
    }));
});
