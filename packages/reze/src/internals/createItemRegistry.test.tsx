import { cleanup, mount, tick } from "@rezejs/testing-library";
import { effect } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { createItemRegistry } from "./createItemRegistry";

afterEach(cleanup);

describe("createItemRegistry", () => {
  it("publishes registrations in the snapshot and removes them on unregister", () => {
    const registry = createItemRegistry<string, number>();
    expect(registry.items().size).toBe(0);

    const unregisterA = registry.registerItem("a", 1);
    const unregisterB = registry.registerItem("b", 2);
    expect(registry.items().get("a")).toBe(1);
    expect(registry.items().get("b")).toBe(2);

    unregisterA();
    expect(registry.items().has("a")).toBe(false);
    expect(registry.items().get("b")).toBe(2);

    unregisterB();
    expect(registry.items().size).toBe(0);
  });

  it("exposes the live registry synchronously", () => {
    const registry = createItemRegistry<string, number>();
    const unregister = registry.registerItem("a", 1);
    expect(registry.liveItems.get("a")).toBe(1);
    unregister();
    expect(registry.liveItems.has("a")).toBe(false);
  });

  it("notifies snapshot readers on registration", () => {
    const registry = createItemRegistry<string, number>();
    let observed = -1;
    function Test() {
      effect(() => {
        observed = registry.items().size;
      });
      return <div />;
    }
    mount(() => <Test />);
    tick();
    expect(observed).toBe(0);

    const unregister = registry.registerItem("a", 1);
    tick();
    expect(observed).toBe(1);

    unregister();
    tick();
    expect(observed).toBe(0);
  });
});
