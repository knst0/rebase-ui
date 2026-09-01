import { createEffect, createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { createElementRegistry } from "./createElementRegistry";

function createList(count: number, attached: boolean) {
  const container = document.createElement("div");
  const elements = Array.from({ length: count }, () => document.createElement("button"));

  for (const element of elements) {
    container.appendChild(element);
  }

  if (attached) {
    document.body.appendChild(container);
  }

  return { container, elements };
}

describe("createElementRegistry", () => {
  it("orders attached elements by document position regardless of registration order", () => {
    createRoot((dispose) => {
      const { elements } = createList(4, true);
      const registry = createElementRegistry<never>();

      for (const element of [elements[2], elements[0], elements[3], elements[1]]) {
        registry.register(element);
      }
      flush();

      expect(registry.elements()).toEqual(elements);
      dispose();
    });
  });

  it("falls back to registration order for detached elements", () => {
    createRoot((dispose) => {
      const { elements } = createList(3, false);
      const registry = createElementRegistry<never>();

      for (const element of elements) {
        registry.register(element);
      }
      flush();

      expect(registry.elements()).toEqual(elements);
      dispose();
    });
  });

  it("resolves indexOf to the document-order position", () => {
    createRoot((dispose) => {
      const { elements } = createList(3, true);
      const registry = createElementRegistry<never>();

      registry.register(elements[1]);
      registry.register(elements[0]);
      registry.register(elements[2]);
      flush();

      expect(registry.indexOf(elements[0])).toBe(0);
      expect(registry.indexOf(elements[1])).toBe(1);
      expect(registry.indexOf(elements[2])).toBe(2);
      dispose();
    });
  });

  it("returns -1 for null and unregistered elements", () => {
    createRoot((dispose) => {
      const { elements } = createList(2, true);
      const registry = createElementRegistry<never>();
      registry.register(elements[0]);
      flush();

      expect(registry.indexOf(null)).toBe(-1);
      expect(registry.indexOf(elements[1])).toBe(-1);
      dispose();
    });
  });

  it("removes unregistered elements and reindexes the remainder", () => {
    createRoot((dispose) => {
      const { elements } = createList(3, true);
      const registry = createElementRegistry<never>();

      for (const element of elements) {
        registry.register(element);
      }
      registry.unregister(elements[0]);
      flush();

      expect(registry.elements()).toEqual([elements[1], elements[2]]);
      expect(registry.indexOf(elements[1])).toBe(0);
      expect(registry.indexOf(elements[0])).toBe(-1);
      dispose();
    });
  });

  it("ignores unregistering an element that was never registered", () => {
    createRoot((dispose) => {
      const { elements } = createList(2, true);
      const registry = createElementRegistry<never>();
      registry.register(elements[0]);

      registry.unregister(elements[1]);
      flush();

      expect(registry.elements()).toEqual([elements[0]]);
      dispose();
    });
  });

  it("resolves accessor metadata lazily so later reads observe updates", () => {
    createRoot((dispose) => {
      const { elements } = createList(1, true);
      const registry = createElementRegistry<{ label: string }>();
      const [label, setLabel] = createSignal("before", { ownedWrite: true });

      registry.register(elements[0], () => ({ label: label() }));
      flush();

      expect(registry.metadataOf(elements[0])).toEqual({ label: "before" });

      setLabel("after");
      flush();

      expect(registry.metadataOf(elements[0])).toEqual({ label: "after" });
      dispose();
    });
  });

  it("supports plain object metadata", () => {
    createRoot((dispose) => {
      const { elements } = createList(1, true);
      const registry = createElementRegistry<{ value: number }>();

      registry.register(elements[0], { value: 7 });
      flush();

      expect(registry.metadataOf(elements[0])).toEqual({ value: 7 });
      dispose();
    });
  });

  it("recomputes document order once per batch, not once per registration", () => {
    createRoot((dispose) => {
      const { elements } = createList(20, true);
      const registry = createElementRegistry<never>();

      let recomputes = 0;
      createEffect(
        () => registry.elements(),
        (items) => {
          recomputes += 1;
          expect(items.length).toBeGreaterThan(0);
        },
      );

      for (const element of elements) {
        registry.register(element);
      }
      flush();

      expect(recomputes).toBe(1);
      dispose();
    });
  });

  it("invalidates indexOf consumers when the set of elements changes", () => {
    createRoot((dispose) => {
      const { container, elements } = createList(2, true);
      const registry = createElementRegistry<never>();
      registry.register(elements[1]);

      const observed: number[] = [];
      createEffect(
        () => registry.indexOf(elements[1]),
        (index) => {
          observed.push(index);
        },
      );
      flush();

      const inserted = document.createElement("button");
      container.insertBefore(inserted, elements[1]);
      registry.register(inserted);
      flush();

      expect(observed).toEqual([0, 1]);
      dispose();
    });
  });
});
