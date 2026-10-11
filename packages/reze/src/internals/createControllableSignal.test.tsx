import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { createControllableSignal } from "./createControllableSignal";

afterEach(cleanup);

describe("createControllableSignal", () => {
  it("uses the default value and updates it uncontrolled", () => {
    function Test() {
      const [value, setValue] = createControllableSignal({ value: () => undefined, defaultValue: () => "default" });
      return (
        <>
          <span data-testid="value">{value()}</span>
          <button onClick={() => setValue("next")}>Set</button>
        </>
      );
    }
    const { el } = mount(() => <Test />);

    const output = el.querySelector('[data-testid="value"]')!;
    expect(output.textContent).toBe("default");

    fire(el.querySelector("button")!, "click");
    tick();

    expect(output.textContent).toBe("next");
  });

  it("stores a function default value instead of calling it", () => {
    const defaultValue = () => "called";
    let observed: unknown;

    function Test() {
      const [value] = createControllableSignal({ value: () => undefined, defaultValue: () => defaultValue });
      observed = value();
      return <span />;
    }
    mount(() => <Test />);
    tick();

    expect(observed).toBe(defaultValue);
  });

  it("stores a function set later instead of calling it as an updater", () => {
    const nextValue = () => "next";

    function Test() {
      const [value, setValue] = createControllableSignal<string | (() => string)>({
        value: () => undefined,
        defaultValue: () => "initial",
      });
      return (
        <>
          <span data-testid="value">{value() === nextValue ? "fn" : "other"}</span>
          <button onClick={() => setValue(nextValue)}>Set</button>
        </>
      );
    }
    const { el } = mount(() => <Test />);
    tick();

    fire(el.querySelector("button")!, "click");
    tick();

    expect(el.querySelector('[data-testid="value"]')!.textContent).toBe("fn");
  });

  it("prefers the controlled value and notifies on change", () => {
    const onChange = vi.fn();

    function Test() {
      let controlled = signal("controlled");
      const [value, setValue] = createControllableSignal({
        value: () => controlled,
        defaultValue: () => "default",
        onChange,
      });
      return (
        <>
          <span data-testid="value">{value()}</span>
          <button onClick={() => setValue("next")}>Set</button>
          <button onClick={() => (controlled = "updated")}>Control</button>
        </>
      );
    }
    const { el } = mount(() => <Test />);

    const output = el.querySelector('[data-testid="value"]')!;
    expect(output.textContent).toBe("controlled");

    fire(el.querySelectorAll("button")[0]!, "click");
    tick();

    expect(onChange).toHaveBeenCalledWith("next");
    expect(output.textContent).toBe("controlled");

    fire(el.querySelectorAll("button")[1]!, "click");
    tick();

    expect(output.textContent).toBe("updated");
  });
});
