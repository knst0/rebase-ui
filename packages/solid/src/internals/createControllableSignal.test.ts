import { createRoot, flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { createControllableSignal } from "./createControllableSignal";

describe("createControllableSignal", () => {
  it("stores a function default value instead of calling it", () => {
    const defaultValue = () => "called";

    createRoot((dispose) => {
      const [value] = createControllableSignal({ value: () => undefined, defaultValue: () => defaultValue });
      flush();

      expect(value()).toBe(defaultValue);
      dispose();
    });
  });

  it("stores a function set later instead of calling it as an updater", () => {
    const nextValue = () => "next";

    let value!: () => string | (() => string) | undefined;
    let setValue!: (next: string | (() => string)) => void;
    const dispose = createRoot((d) => {
      [value, setValue] = createControllableSignal<string | (() => string)>({
        value: () => undefined,
        defaultValue: () => "initial",
      });
      return d;
    });
    flush();

    // Writes must happen outside the root callback (an owned scope).
    setValue(nextValue);
    flush();

    expect(value()).toBe(nextValue);
    dispose();
  });

  it("prefers the controlled value and notifies on change", () => {
    const onChange = vi.fn();

    createRoot((dispose) => {
      const [value, setValue] = createControllableSignal({ value: () => "controlled", defaultValue: () => "default", onChange });
      flush();

      expect(value()).toBe("controlled");
      setValue("next");
      flush();

      expect(onChange).toHaveBeenCalledWith("next");
      expect(value()).toBe("controlled");
      dispose();
    });
  });
});
