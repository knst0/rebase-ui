import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { fireEvent, screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { renderWithCombobox } from "../test-utils";
import { ComboboxClear } from "./ComboboxClear";

afterEach(cleanup);

describe("<Combobox.Clear />", () => {
  it("is not rendered without a selection", () => {
    renderWithCombobox(() => <ComboboxClear />);
    tick();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders when a single value is selected", () => {
    renderWithCombobox(() => <ComboboxClear />, {
      storeState: { selectedValue: "sans" },
    });
    tick();

    const clear = screen.getByRole("button");
    expect(clear).toHaveTextContent("x");
    expect(clear).toHaveAttribute("tabindex", "-1");
    expect(clear).toHaveAttribute("data-visible");
  });

  it("renders when the input has a value in none mode", () => {
    const { harness } = renderWithCombobox(() => <ComboboxClear />, {
      storeState: { selectionMode: "none" },
    });
    harness.store.context.setInputValue("a", { reason: "input-change" } as never);
    tick();

    expect(screen.getByRole("button")).toHaveAttribute("data-visible");
  });

  it("clears the input and selection on click", () => {
    const { harness } = renderWithCombobox(
      () => (
        <>
          <input data-testid="field" />
          <ComboboxClear />
        </>
      ),
      { storeState: { selectedValue: "sans" } },
    );
    tick();
    harness.store.context.inputRef.current = screen.getByTestId("field") as HTMLInputElement;

    fireEvent.click(screen.getByRole("button"));
    tick();

    expect(harness.inputValueCalls.at(-1)).toEqual({ value: "", reason: "clear-press" });
    expect(harness.selectedValueCalls.at(-1)).toEqual({ value: null, reason: "clear-press" });
    expect(harness.indicesCalls.at(-1)).toMatchObject({ activeIndex: null, selectedIndex: null });
  });

  it("clears to an empty array in multiple mode", () => {
    const { harness } = renderWithCombobox(() => <ComboboxClear />, {
      storeState: { selectionMode: "multiple", selectedValue: ["a", "b"] },
    });
    tick();

    fireEvent.click(screen.getByRole("button"));
    tick();

    expect(harness.selectedValueCalls.at(-1)).toEqual({ value: [], reason: "clear-press" });
  });

  it("does nothing while disabled or readonly", () => {
    const { harness } = renderWithCombobox(() => <ComboboxClear />, {
      storeState: { selectedValue: "sans", readOnly: true },
    });
    tick();

    fireEvent.click(screen.getByRole("button"));
    tick();

    expect(harness.inputValueCalls.length).toBe(0);
    expect(harness.selectedValueCalls.length).toBe(0);
  });

  it("stays mounted with keepMounted even when not visible", () => {
    renderWithCombobox(() => <ComboboxClear keepMounted />);
    tick();

    const clear = screen.getByRole("button");
    expect(clear).toBeInTheDocument();
    expect(clear).not.toHaveAttribute("data-visible");
  });

  it("throws a descriptive error when rendered outside <Combobox.Root>", () => {
    expect(() => {
      mount(() => <ComboboxClear />);
      tick();
    }).toThrow(/ComboboxRootContext is missing/);
  });
});
