import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Menu from "../index.parts";

function FilterMenu(props: { clearDisabled?: boolean; onValueChange?: (value: string, details: { reason: string }) => void }) {
  return (
    <Menu.FilterProvider onValueChange={props.onValueChange}>
      <Menu.Root>
        <Menu.Trigger>Open menu</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Input aria-label="Filter actions" />
              <Menu.Clear aria-label="Clear filter" disabled={props.clearDisabled}>
                Clear
              </Menu.Clear>
              <Menu.List>
                <Menu.Item>Apple</Menu.Item>
                <Menu.Item>Banana</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  );
}

describe("<Menu.Clear />", () => {
  it("throws outside a filterable menu", () => {
    expect(() => render(() => <Menu.Clear>Clear</Menu.Clear>)).toThrow(/must be placed in a menu wrapped in <Menu\.FilterProvider>/);
  });

  it("does not render when the filter value is empty", async () => {
    render(() => <FilterMenu />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    flush();
    await nextFrames();

    expect(screen.queryByText("Clear")).toBeNull();
  });

  it("clears the filter value with the clear-press reason and focuses the input", async () => {
    const onValueChange = vi.fn();
    render(() => <FilterMenu onValueChange={onValueChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    flush();
    await nextFrames();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.click(input);
    await user.type(input, "a");
    flush();
    expect(input).toHaveValue("a");

    // The button is aria-hidden (it duplicates the input's own clearing), so query by text.
    await user.click(screen.getByText("Clear"));
    flush();

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByText("Clear")).toBeNull();
    expect(onValueChange).toHaveBeenLastCalledWith("", expect.objectContaining({ reason: "clear-press" }));
  });

  it("does nothing when disabled", async () => {
    const onValueChange = vi.fn();
    render(() => <FilterMenu clearDisabled onValueChange={onValueChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    flush();
    await nextFrames();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.click(input);
    await user.type(input, "a");
    flush();

    const clear = screen.getByText("Clear").closest("button") as HTMLButtonElement;
    expect(clear).toBeDisabled();

    await user.click(clear);
    flush();

    expect(input).toHaveValue("a");
    expect(onValueChange).not.toHaveBeenCalledWith("", expect.anything());
  });
});
