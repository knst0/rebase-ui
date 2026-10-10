import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import * as Select from "../index.parts";
import { SelectItemContext } from "../item/SelectItemContext";
import { SelectItemIndicator } from "./SelectItemIndicator";

function renderIndicator(selected: boolean, props?: Record<string, unknown>) {
  render(() => (
    <SelectItemContext value={{ selected: () => selected, index: () => 0, textRef: { current: null }, selectedByFocus: () => false }}>
      <SelectItemIndicator data-testid="indicator" {...props} />
    </SelectItemContext>
  ));
  flush();
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
    const [value, setValue] = createSignal("b");
    render(() => <Selection value={value()} />);
    flush();

    expect(screen.queryByTestId("indicator")).toBe(null);

    setValue("a");
    flush();

    const indicator = screen.getByTestId("indicator");
    expect(indicator).toHaveAttribute("data-selected");
    expect(indicator).toHaveAttribute("aria-hidden", "true");
    expect(indicator).not.toHaveAttribute("selected");

    setValue("b");
    flush();

    expect(screen.queryByTestId("indicator")).toBe(null);

    setValue("a");
    flush();

    expect(screen.getByTestId("indicator")).toHaveAttribute("data-selected");
  });

  it("preserves the kept-mounted element across selection changes", async () => {
    const [value, setValue] = createSignal("b");
    render(() => <Selection value={value()} keepMounted />);
    flush();
    const indicator = screen.getByTestId("indicator");

    expect(indicator).not.toHaveAttribute("data-selected");

    setValue("a");
    flush();

    expect(screen.getByTestId("indicator")).toBe(indicator);
    expect(indicator).toHaveAttribute("data-selected");

    setValue("b");
    flush();

    expect(screen.getByTestId("indicator")).toBe(indicator);
    expect(indicator).not.toHaveAttribute("data-selected");
    await waitFor(() => {
      expect(indicator).not.toHaveAttribute("data-ending-style");
    });

    setValue("a");
    flush();

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
