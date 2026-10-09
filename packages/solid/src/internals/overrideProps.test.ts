import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { overrideProps } from "./overrideProps";

describe("overrideProps", () => {
  it("forwards the external props that are not overridden", () => {
    const props = overrideProps({ id: "one", role: "tab" }, { role: "button" });

    expect(props.id).toBe("one");
    expect(props.role).toBe("button");
  });

  it("keeps forwarded props lazy", () => {
    const [value, setValue] = createSignal("one");
    const props = overrideProps(
      {
        get id() {
          return value();
        },
      },
      {},
    );

    expect(props.id).toBe("one");
    setValue("two");
    flush();
    expect(props.id).toBe("two");
  });

  it("does not evaluate getters on the overrides while merging", () => {
    const get = vi.fn(() => "evaluated");
    const props = overrideProps(
      {},
      {
        get tabIndex() {
          return get();
        },
      },
    );

    expect(get).not.toHaveBeenCalled();
    expect(props.tabIndex).toBe("evaluated");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("keeps overridden getters reactive", () => {
    const [index, setIndex] = createSignal(0);
    const props = overrideProps(
      { tabIndex: -1 },
      {
        get tabIndex() {
          return index();
        },
      },
    );

    expect(props.tabIndex).toBe(0);
    setIndex(3);
    flush();
    expect(props.tabIndex).toBe(3);
  });

  it("enumerates the union of both sources exactly once", () => {
    const props = overrideProps({ id: "one", role: "tab" }, { role: "button", onClick: () => {} });

    expect(Object.keys(props).sort()).toEqual(["id", "onClick", "role"]);
  });

  it("ignores prototype-polluting keys", () => {
    const external = JSON.parse('{"__proto__": {"polluted": true}, "id": "one"}');
    const props = overrideProps(external, JSON.parse('{"constructor": "nope"}'));

    expect(props.id).toBe("one");
    expect(Object.keys(props)).toEqual(["id"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("lets an override shadow an external prop that only exists as a getter", () => {
    let reads = 0;
    const external = {
      get onClick() {
        reads += 1;
        return () => {};
      },
    };

    const props = overrideProps(external, { onClick: () => "overridden" });

    expect(props.onClick()).toBe("overridden");
    expect(reads).toBe(0);
  });
});
