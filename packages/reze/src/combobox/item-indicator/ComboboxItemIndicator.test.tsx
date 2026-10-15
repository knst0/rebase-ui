import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { store } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as Combobox from "../index.parts";
import { ComboboxItemContext } from "../item/ComboboxItemContext";
import { ComboboxItemIndicator } from "./ComboboxItemIndicator";

afterEach(cleanup);

function renderIndicator(selected: boolean, props?: Record<string, unknown>) {
  mount(() => (
    <ComboboxItemContext value={{ selected: () => selected, textRef: { current: null } }}>
      <ComboboxItemIndicator data-testid="indicator" {...props} />
    </ComboboxItemContext>
  ));
  tick();
}

describe("<Combobox.ItemIndicator />", () => {
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
    const state = store({ value: "b" });
    mount(() => <Selection value={state.value} />);
    tick();

    expect(screen.queryByTestId("indicator")).toBe(null);

    state.value = "a";
    tick();

    const indicator = screen.getByTestId("indicator");
    expect(indicator).toHaveAttribute("data-selected");
    expect(indicator).toHaveAttribute("aria-hidden", "true");
    expect(indicator).not.toHaveAttribute("selected");

    state.value = "b";
    tick();

    expect(screen.queryByTestId("indicator")).toBe(null);

    state.value = "a";
    tick();

    expect(screen.getByTestId("indicator")).toHaveAttribute("data-selected");
  });

  it("preserves the kept-mounted element across selection changes", async () => {
    const state = store({ value: "b" });
    mount(() => <Selection value={state.value} keepMounted />);
    tick();
    const indicator = screen.getByTestId("indicator");

    expect(indicator).not.toHaveAttribute("data-selected");

    state.value = "a";
    tick();

    expect(screen.getByTestId("indicator")).toBe(indicator);
    expect(indicator).toHaveAttribute("data-selected");

    state.value = "b";
    tick();

    expect(screen.getByTestId("indicator")).toBe(indicator);
    expect(indicator).not.toHaveAttribute("data-selected");
    await vi.waitFor(() => {
      expect(indicator).not.toHaveAttribute("data-ending-style");
    });

    state.value = "a";
    tick();

    expect(screen.getByTestId("indicator")).toBe(indicator);
    expect(indicator).toHaveAttribute("data-selected");
  });
});

function Selection(props: { value: string; keepMounted?: boolean }) {
  return (
    <Combobox.Root value={props.value} open>
      <Combobox.Input />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              <Combobox.Item value="a">
                a
                <Combobox.ItemIndicator keepMounted={props.keepMounted} data-testid="indicator" />
              </Combobox.Item>
              <Combobox.Item value="b">b</Combobox.Item>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
