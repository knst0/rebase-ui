import { createRoot, flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { createItemRegistry } from "./createItemRegistry";

describe("createItemRegistry", () => {
  it("publishes registrations in the snapshot and removes them on unregister", () => {
    createRoot((dispose) => {
      const registry = createItemRegistry<string, number>();
      flush();
      expect(registry.items().size).toBe(0);

      const unregisterA = registry.registerItem("a", 1);
      const unregisterB = registry.registerItem("b", 2);
      flush();
      expect(registry.items().get("a")).toBe(1);
      expect(registry.items().get("b")).toBe(2);

      unregisterA();
      flush();
      expect(registry.items().has("a")).toBe(false);
      expect(registry.items().get("b")).toBe(2);

      unregisterB();
      flush();
      expect(registry.items().size).toBe(0);
      dispose();
    });
    flush();
  });

  it("exposes the live registry synchronously", () => {
    createRoot((dispose) => {
      const registry = createItemRegistry<string, number>();
      const unregister = registry.registerItem("a", 1);
      expect(registry.liveItems.get("a")).toBe(1);
      unregister();
      expect(registry.liveItems.has("a")).toBe(false);
      dispose();
    });
    flush();
  });
});
