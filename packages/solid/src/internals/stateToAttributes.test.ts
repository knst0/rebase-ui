import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { applyStateAttributes, getStateAttributes, type StateAttributesMapping, toStateAttributeValue } from "./stateToAttributes";

describe("toStateAttributeValue", () => {
  it("coerces values the way the DOM expects", () => {
    expect(toStateAttributeValue(true)).toBe("");
    expect(toStateAttributeValue("value")).toBe("value");
    expect(toStateAttributeValue(3)).toBe("3");
    expect(toStateAttributeValue(0)).toBe("0");
    expect(toStateAttributeValue(10n)).toBe("10");

    for (const omitted of [false, null, undefined, "", {}, []]) {
      expect(toStateAttributeValue(omitted)).toBeUndefined();
    }
  });
});

describe("getStateAttributes", () => {
  it("names attributes after the lowercased state key", () => {
    const attributes = getStateAttributes({ open: () => true, activeIndex: () => 2 });

    expect(Object.keys(attributes)).toEqual(["data-open", "data-activeindex"]);
    expect(attributes["data-open"]).toBe("");
    expect(attributes["data-activeindex"]).toBe("2");
  });

  it("reads state lazily so getters stay reactive", () => {
    createRoot((dispose) => {
      const [open, setOpen] = createSignal(false, { ownedWrite: true });
      const attributes = getStateAttributes({ open });

      expect(attributes["data-open"]).toBeUndefined();
      setOpen(true);
      flush();
      expect(attributes["data-open"]).toBe("");
      dispose();
    });
  });

  it("exposes every declared key of a custom mapping as a real own property", () => {
    const mapping: StateAttributesMapping<{ status: () => string }> = {
      status: {
        keys: ["data-starting-style", "data-ending-style"],
        map: (value) => (value === "starting" ? { "data-starting-style": "" } : null),
      },
    };

    const attributes = getStateAttributes({ status: () => "starting" }, mapping);

    expect(Object.keys(attributes)).toEqual(["data-starting-style", "data-ending-style"]);
    expect("data-starting-style" in attributes).toBe(true);
    expect(attributes["data-starting-style"]).toBe("");
    expect(attributes["data-ending-style"]).toBeUndefined();
    expect({ ...attributes }).toEqual({ "data-starting-style": "", "data-ending-style": undefined });
  });

  it("is a plain object rather than a proxy", () => {
    const mapping: StateAttributesMapping<{ status: () => string }> = {
      status: { keys: ["data-x"], map: () => ({ "data-x": "1" }) },
    };
    const attributes = getStateAttributes({ status: () => "on" }, mapping);

    expect(Object.getPrototypeOf(attributes)).toBe(Object.prototype);
    expect("data-not-declared" in attributes).toBe(false);
    expect(Object.getOwnPropertyDescriptor(attributes, "data-x")?.get).toBeTypeOf("function");
  });

  it("drops the default attribute when a mapping declares no keys", () => {
    const mapping: StateAttributesMapping<{ size: () => number }> = {
      size: { keys: [], map: () => null },
    };
    const attributes = getStateAttributes({ size: () => 4 }, mapping);

    expect(Object.keys(attributes)).toEqual([]);
    expect(attributes["data-size"]).toBeUndefined();
  });

  it("lets a later state key win a shared attribute name", () => {
    const mapping: StateAttributesMapping<{ a: () => string; b: () => string }> = {
      a: { keys: ["data-shared"], map: () => ({ "data-shared": "a" }) },
      b: { keys: ["data-shared"], map: () => ({ "data-shared": "b" }) },
    };
    const attributes = getStateAttributes({ a: () => "", b: () => "" }, mapping);

    expect(attributes["data-shared"]).toBe("b");
  });
});

describe("applyStateAttributes", () => {
  function setup(state: Record<string, () => unknown>, mapping?: StateAttributesMapping<any>, owned: Record<string, unknown> = {}) {
    const element = document.createElement("div");
    const dispose = createRoot((disposer) => {
      applyStateAttributes(element, state, mapping, owned);
      return disposer;
    });
    flush();
    return { element, dispose };
  }

  it("writes and removes plain state attributes as the state changes", () => {
    const [open, setOpen] = createSignal(false, { ownedWrite: true });
    const { element, dispose } = setup({ open });

    expect(element.hasAttribute("data-open")).toBe(false);

    setOpen(true);
    flush();
    expect(element.getAttribute("data-open")).toBe("");

    setOpen(false);
    flush();
    expect(element.hasAttribute("data-open")).toBe(false);
    dispose();
  });

  it("applies mapped attributes and cleans up the ones it stops producing", () => {
    const [status, setStatus] = createSignal("starting", { ownedWrite: true });
    const mapping: StateAttributesMapping<any> = {
      status: {
        keys: ["data-starting-style", "data-ending-style"],
        map: (value: string): Record<string, string> | null => {
          if (value === "starting") return { "data-starting-style": "" };
          if (value === "ending") return { "data-ending-style": "" };
          return null;
        },
      },
    };

    const { element, dispose } = setup({ status }, mapping);
    expect(element.getAttribute("data-starting-style")).toBe("");

    setStatus("ending");
    flush();
    expect(element.hasAttribute("data-starting-style")).toBe(false);
    expect(element.getAttribute("data-ending-style")).toBe("");

    setStatus("idle");
    flush();
    expect(element.hasAttribute("data-ending-style")).toBe(false);
    dispose();
  });

  it("never overwrites an attribute owned by props", () => {
    const mapping: StateAttributesMapping<any> = {
      status: { keys: ["data-mapped"], map: () => ({ "data-mapped": "from-state" }) },
    };
    const { element, dispose } = setup({ open: () => true, status: () => "on" }, mapping, {
      "data-open": true,
      "data-mapped": true,
    });

    expect(element.hasAttribute("data-open")).toBe(false);
    expect(element.hasAttribute("data-mapped")).toBe(false);
    dispose();
  });
});

describe("applyStateAttributes: single-effect behaviour", () => {
  function mount(state: Record<string, () => unknown>, mapping?: StateAttributesMapping<any>, owned: Record<string, unknown> = {}) {
    const element = document.createElement("div");
    const dispose = createRoot((disposer) => {
      applyStateAttributes(element, state, mapping, owned);
      return disposer;
    });
    flush();
    return { element, dispose };
  }

  it("keeps unrelated attributes untouched when one state value changes", () => {
    const [open, setOpen] = createSignal(false, { ownedWrite: true });
    const { element, dispose } = mount({ open, index: () => 2, orientation: () => "horizontal" });

    const writes: string[] = [];
    const setAttribute = element.setAttribute.bind(element);
    element.setAttribute = (name: string, value: string) => {
      writes.push(name);
      setAttribute(name, value);
    };

    setOpen(true);
    flush();

    expect(writes).toEqual(["data-open"]);
    expect(element.getAttribute("data-index")).toBe("2");
    expect(element.getAttribute("data-orientation")).toBe("horizontal");
    dispose();
  });

  it("writes nothing when a state change does not alter any attribute value", () => {
    const [count, setCount] = createSignal(0, { ownedWrite: true });
    const { element, dispose } = mount({ active: () => count() >= 0 });

    let writes = 0;
    const setAttribute = element.setAttribute.bind(element);
    element.setAttribute = (name: string, value: string) => {
      writes += 1;
      setAttribute(name, value);
    };

    setCount(5);
    flush();

    expect(writes).toBe(0);
    expect(element.getAttribute("data-active")).toBe("");
    dispose();
  });

  it("creates no reactive work when props own every attribute", () => {
    const [open, setOpen] = createSignal(false, { ownedWrite: true });
    let reads = 0;
    const tracked = () => {
      reads += 1;
      return open();
    };

    const { element, dispose } = mount({ open: tracked }, undefined, { "data-open": true });

    expect(reads).toBe(0);
    setOpen(true);
    flush();
    expect(reads).toBe(0);
    expect(element.hasAttribute("data-open")).toBe(false);
    dispose();
  });

  it("skips a mapping entirely when props own all of its declared keys", () => {
    let mapped = 0;
    const mapping: StateAttributesMapping<any> = {
      status: {
        keys: ["data-a", "data-b"],
        map: () => {
          mapped += 1;
          return { "data-a": "1" };
        },
      },
    };

    const { dispose } = mount({ status: () => "on" }, mapping, { "data-a": true, "data-b": true });
    expect(mapped).toBe(0);
    dispose();
  });

  it("removes attributes that disappear across a batched multi-key change", () => {
    const [open, setOpen] = createSignal(true, { ownedWrite: true });
    const [status, setStatus] = createSignal("starting", { ownedWrite: true });
    const mapping: StateAttributesMapping<any> = {
      status: {
        keys: ["data-starting-style"],
        map: (value: string) => (value === "starting" ? { "data-starting-style": "" } : null),
      },
    };

    const { element, dispose } = mount({ open, status }, mapping);
    expect(element.hasAttribute("data-open")).toBe(true);
    expect(element.hasAttribute("data-starting-style")).toBe(true);

    setOpen(false);
    setStatus("idle");
    flush();

    expect(element.hasAttribute("data-open")).toBe(false);
    expect(element.hasAttribute("data-starting-style")).toBe(false);
    dispose();
  });
});
