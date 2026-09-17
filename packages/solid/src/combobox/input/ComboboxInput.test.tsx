import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { renderWithCombobox } from "../test-utils";
import { ComboboxInput } from "./ComboboxInput";

function renderInput(inputProps: Record<string, unknown> = {}, harnessOptions: Record<string, unknown> = {}) {
  return renderWithCombobox(() => <ComboboxInput {...inputProps} />, harnessOptions);
}

function getInput(): HTMLInputElement {
  return screen.getByRole("textbox") as HTMLInputElement;
}

/**
 * Dispatches a realistic typing event. A missing `inputType` (pass `null`)
 * looks like an autofill commit, which must update the value without opening.
 */
function typeInto(input: HTMLElement, value: string, inputType: string | null = "insertText") {
  const event = new Event("input", { bubbles: true, cancelable: true, composed: true });
  if (inputType !== null) {
    Object.defineProperty(event, "inputType", { value: inputType });
  }
  (input as HTMLInputElement).value = value;
  input.dispatchEvent(event);
}

describe("<Combobox.Input />", () => {
  it("renders an empty combobox input", () => {
    renderInput();
    flush();
    const input = getInput();
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveValue("");
    expect(input).not.toHaveAttribute("data-popup-open");
  });

  it("commits typed text with an input-change reason and opens", () => {
    const { harness } = renderInput({}, { items: ["Apple", "Banana"] });
    flush();

    typeInto(getInput(), "ap");
    flush();

    expect(harness.inputValueCalls).toEqual([{ value: "ap", reason: "input-change" }]);
    expect(harness.openCalls).toEqual([{ open: true, reason: "input-change" }]);
    expect(getInput()).toHaveValue("ap");
  });

  it("does not open for autofill-like commits without an inputType", () => {
    const { harness } = renderInput({}, { items: ["Apple", "Banana"] });
    flush();

    typeInto(getInput(), "ap", null);
    flush();

    expect(harness.inputValueCalls).toEqual([{ value: "ap", reason: "input-change" }]);
    expect(harness.openCalls.length).toBe(0);
  });

  it("clears the single selection when emptied", () => {
    const { harness } = renderInput({}, { storeState: { selectedValue: "Apple", open: true, mounted: true, openOnInputClick: false } });
    harness.store.context.setInputValue("Apple", { reason: "none" } as never);
    flush();

    typeInto(getInput(), "");
    flush();

    expect(harness.selectedValueCalls).toEqual([{ value: null, reason: "input-clear" }]);
    expect(harness.openCalls).toEqual([{ open: false, reason: "input-clear" }]);
  });

  it("commits the highlighted item on Enter", () => {
    const { harness } = renderInput({}, { storeState: { open: true, mounted: true, activeIndex: 0 } });
    const onItemClick = vi.fn();
    const item = document.createElement("button");
    item.addEventListener("click", onItemClick);
    document.body.appendChild(item);
    harness.store.context.listRef.current = [item];
    flush();

    try {
      fireEvent.keyDown(getInput(), { key: "Enter" });
      flush();

      expect(onItemClick).toHaveBeenCalledTimes(1);
    } finally {
      item.remove();
    }
  });

  it("closes without committing on Enter when nothing is highlighted", () => {
    const { harness } = renderInput({}, { storeState: { open: true, mounted: true, activeIndex: null } });
    flush();

    fireEvent.keyDown(getInput(), { key: "Enter" });
    flush();

    expect(harness.openCalls).toEqual([{ open: false, reason: "none" }]);
  });

  it("clears the input and selection on Escape while closed", () => {
    const { harness } = renderInput({}, { storeState: { selectedValue: "Apple", open: false, mounted: false } });
    harness.store.context.setInputValue("Apple", { reason: "none" } as never);
    harness.inputValueCalls.length = 0;
    harness.selectedValueCalls.length = 0;
    flush();

    fireEvent.keyDown(getInput(), { key: "Escape" });
    flush();

    expect(harness.inputValueCalls).toEqual([{ value: "", reason: "escape-key" }]);
    expect(harness.selectedValueCalls).toEqual([{ value: null, reason: "escape-key" }]);
  });

  it("does not clear on Escape while open", () => {
    const { harness } = renderInput({}, { storeState: { selectedValue: "Apple", open: true, mounted: true } });
    flush();

    fireEvent.keyDown(getInput(), { key: "Escape" });
    flush();

    expect(harness.inputValueCalls.length).toBe(0);
    expect(harness.selectedValueCalls.length).toBe(0);
  });

  it("does not commit on Enter while readonly", () => {
    const { harness } = renderInput({}, { storeState: { open: true, mounted: true, activeIndex: 0, readOnly: true } });
    const onItemClick = vi.fn();
    const item = document.createElement("button");
    item.addEventListener("click", onItemClick);
    document.body.appendChild(item);
    harness.store.context.listRef.current = [item];
    flush();

    try {
      fireEvent.keyDown(getInput(), { key: "Enter" });
      flush();

      expect(onItemClick).not.toHaveBeenCalled();
      expect(harness.openCalls.length).toBe(0);
    } finally {
      item.remove();
    }
  });

  it("defers filtering across IME composition", () => {
    const { harness } = renderInput({}, { items: ["Apple"] });
    flush();
    const input = getInput();

    fireEvent.compositionStart(input);
    typeInto(input, "a");
    flush();

    expect(harness.inputValueCalls.length).toBe(0);

    fireEvent.compositionEnd(input);
    flush();

    expect(harness.inputValueCalls).toEqual([{ value: "a", reason: "input-change" }]);
  });

  it("exposes readonly and open state hooks", () => {
    renderInput({}, { storeState: { readOnly: true, open: true, mounted: true } });
    flush();

    const input = getInput();
    expect(input).toHaveAttribute("data-readonly");
    expect(input).toHaveAttribute("data-popup-open", "");
    expect(input).toHaveAttribute("aria-readonly", "true");
  });

  it("reflects a disabled state", () => {
    renderInput({}, { storeState: { disabled: true } });
    flush();

    const input = getInput();
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("data-disabled");
  });

  it("throws a descriptive error when rendered outside <Combobox.Root>", () => {
    expect(() => {
      render(() => <ComboboxInput />);
      flush();
    }).toThrow(/ComboboxRootContext is missing/);
  });
});
