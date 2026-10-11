import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as Select from "../index.parts";
import { SelectItemContext } from "../item/SelectItemContext";
import { SelectItemIndicator } from "./SelectItemIndicator";

afterEach(cleanup);

function renderIndicator(selected: boolean, props?: Record<string, unknown>) {
  mount(() => (
    <SelectItemContext value={{ selected: () => selected, index: () => 0, textRef: { current: null }, selectedByFocus: () => false }}>
      <SelectItemIndicator data-testid="indicator" {...props} />
    </SelectItemContext>
  ));
  tick();
}

describe("<Select.ItemIndicator />", () => {
  it("renders when the item is selected", () => {
    renderIndicator(true);

    const indicator = screen.getByTestId("indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("aria-hidden", "true");
  });

  it("renders nothing when the item is not selected", () => {
    renderIndicator(false);

    expect(screen.queryByTestId("indicator")).toBe(null);
  });

  it("stays mounted with keepMounted when the item is not selected", () => {
    renderIndicator(false, { keepMounted: true });

    expect(screen.getByTestId("indicator")).toBeInTheDocument();
  });

  it("mounts only while selected when keepMounted is false", () => {
    let setValue!: (value: string) => void;
    function Test() {
      let value = signal("b");
      setValue = (next: string) => {
        value = next;
      };
      return <Selection value={value} />;
    }
    mount(() => <Test />);
    tick();

    expect(screen.queryByTestId("indicator")).toBe(null);

    setValue("a");
    tick();

    const indicator = screen.getByTestId("indicator");
    expect(indicator).toHaveAttribute("data-selected");
    expect(indicator).toHaveAttribute("aria-hidden", "true");
    expect(indicator).not.toHaveAttribute("selected");

    setValue("b");
    tick();

    expect(screen.queryByTestId("indicator")).toBe(null);

    setValue("a");
    tick();

    expect(screen.getByTestId("indicator")).toHaveAttribute("data-selected");
  });

  it("preserves the kept-mounted element across selection changes", async () => {
    let setValue!: (value: string) => void;
    function Test() {
      let value = signal("b");
      setValue = (next: string) => {
        value = next;
      };
      return <Selection value={value} keepMounted />;
    }
    mount(() => <Test />);
    tick();
    const indicator = screen.getByTestId("indicator");

    expect(indicator).not.toHaveAttribute("data-selected");

    setValue("a");
    tick();

    expect(screen.getByTestId("indicator")).toBe(indicator);
    expect(indicator).toHaveAttribute("data-selected");

    setValue("b");
    tick();

    expect(screen.getByTestId("indicator")).toBe(indicator);
    expect(indicator).not.toHaveAttribute("data-selected");
    await vi.waitFor(() => {
      expect(indicator).not.toHaveAttribute("data-ending-style");
    });

    setValue("a");
    tick();

    expect(screen.getByTestId("indicator")).toBe(indicator);
    expect(indicator).toHaveAttribute("data-selected");
  });
});

function Selection(props: { value: string; keepMounted?: boolean }) {
  return (
    <Select.Root value={props.value} open>
      <Select.Trigger />
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            <Select.Item value="a">
              a
              <Select.ItemIndicator keepMounted={props.keepMounted} data-testid="indicator" />
            </Select.Item>
            <Select.Item value="b">b</Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
