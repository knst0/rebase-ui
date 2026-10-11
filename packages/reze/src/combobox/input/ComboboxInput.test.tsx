import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { fireEvent, screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { ComboboxChip } from "../chip/ComboboxChip";
import { ComboboxChips } from "../chips/ComboboxChips";
import { ComboboxRoot } from "../root/ComboboxRoot";
import { renderWithCombobox } from "../test-utils";
import { ComboboxValue } from "../value/ComboboxValue";
import { ComboboxInput } from "./ComboboxInput";

afterEach(cleanup);

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
    tick();
    const input = getInput();
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveValue("");
    expect(input).not.toHaveAttribute("data-popup-open");
  });

  it("commits typed text with an input-change reason and opens", () => {
    const { harness } = renderInput({}, { items: ["Apple", "Banana"] });
    tick();

    typeInto(getInput(), "ap");
    tick();

    expect(harness.inputValueCalls).toEqual([{ value: "ap", reason: "input-change" }]);
    expect(harness.openCalls).toEqual([{ open: true, reason: "input-change" }]);
    expect(getInput()).toHaveValue("ap");
  });

  it("does not open for autofill-like commits without an inputType", () => {
    const { harness } = renderInput({}, { items: ["Apple", "Banana"] });
    tick();

    typeInto(getInput(), "ap", null);
    tick();

    expect(harness.inputValueCalls).toEqual([{ value: "ap", reason: "input-change" }]);
    expect(harness.openCalls.length).toBe(0);
  });

  it("clears the single selection when emptied", () => {
    const { harness } = renderInput({}, { storeState: { selectedValue: "Apple", open: true, mounted: true, openOnInputClick: false } });
    harness.store.context.setInputValue("Apple", { reason: "none" } as never);
    tick();

    typeInto(getInput(), "");
    tick();

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
    tick();

    try {
      fireEvent.keyDown(getInput(), { key: "Enter" });
      tick();

      expect(onItemClick).toHaveBeenCalledTimes(1);
    } finally {
      item.remove();
    }
  });

  it("closes without committing on Enter when nothing is highlighted", () => {
    const { harness } = renderInput({}, { storeState: { open: true, mounted: true, activeIndex: null } });
    tick();

    fireEvent.keyDown(getInput(), { key: "Enter" });
    tick();

    expect(harness.openCalls).toEqual([{ open: false, reason: "none" }]);
  });

  it("clears the input and selection on Escape while closed", () => {
    const { harness } = renderInput({}, { storeState: { selectedValue: "Apple", open: false, mounted: false } });
    harness.store.context.setInputValue("Apple", { reason: "none" } as never);
    harness.inputValueCalls.length = 0;
    harness.selectedValueCalls.length = 0;
    tick();

    fireEvent.keyDown(getInput(), { key: "Escape" });
    tick();

    expect(harness.inputValueCalls).toEqual([{ value: "", reason: "escape-key" }]);
    expect(harness.selectedValueCalls).toEqual([{ value: null, reason: "escape-key" }]);
  });

  it("does not clear on Escape while open", () => {
    const { harness } = renderInput({}, { storeState: { selectedValue: "Apple", open: true, mounted: true } });
    tick();

    fireEvent.keyDown(getInput(), { key: "Escape" });
    tick();

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
    tick();

    try {
      fireEvent.keyDown(getInput(), { key: "Enter" });
      tick();

      expect(onItemClick).not.toHaveBeenCalled();
      expect(harness.openCalls.length).toBe(0);
    } finally {
      item.remove();
    }
  });

  it("defers filtering across IME composition", () => {
    const { harness } = renderInput({}, { items: ["Apple"] });
    tick();
    const input = getInput();

    fireEvent.compositionStart(input);
    typeInto(input, "a");
    tick();

    expect(harness.inputValueCalls.length).toBe(0);

    fireEvent.compositionEnd(input);
    tick();

    expect(harness.inputValueCalls).toEqual([{ value: "a", reason: "input-change" }]);
  });

  it("exposes readonly and open state hooks", () => {
    renderInput({}, { storeState: { readOnly: true, open: true, mounted: true } });
    tick();

    const input = getInput();
    expect(input).toHaveAttribute("data-readonly");
    expect(input).toHaveAttribute("data-popup-open", "");
    expect(input).toHaveAttribute("aria-readonly", "true");
  });

  it("reflects a disabled state", () => {
    renderInput({}, { storeState: { disabled: true } });
    tick();

    const input = getInput();
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("data-disabled");
  });

  it("throws a descriptive error when rendered outside <Combobox.Root>", () => {
    expect(() => {
      mount(() => <ComboboxInput />);
      tick();
    }).toThrow(/ComboboxRootContext is missing/);
  });

  it("clears the chip highlight when focus returns to the input", async () => {
    const user = userEvent.setup();
    mount(() => (
      <ComboboxRoot multiple defaultValue={["apple", "banana", "cherry"]}>
        <ComboboxChips>
          <ComboboxChip data-testid="chip-apple">apple</ComboboxChip>
          <ComboboxChip data-testid="chip-banana">banana</ComboboxChip>
          <ComboboxChip data-testid="chip-cherry">cherry</ComboboxChip>
          <ComboboxInput data-testid="input" />
        </ComboboxChips>
      </ComboboxRoot>
    ));
    tick();

    const input = screen.getByTestId("input");

    input.focus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByTestId("chip-banana")).toHaveFocus();

    input.focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("chip-cherry")).toHaveFocus();
  });

  it("removes the last chip after clicking from a chip back to the input", async () => {
    const handleValueChange = vi.fn();
    const user = userEvent.setup();
    mount(() => (
      <ComboboxRoot multiple openOnInputClick={false} defaultValue={["apple", "banana", "cherry"]} onValueChange={handleValueChange}>
        <ComboboxChips>
          <ComboboxChip data-testid="chip-apple">apple</ComboboxChip>
          <ComboboxChip data-testid="chip-banana">banana</ComboboxChip>
          <ComboboxChip data-testid="chip-cherry">cherry</ComboboxChip>
          <ComboboxInput data-testid="input" />
        </ComboboxChips>
      </ComboboxRoot>
    ));
    tick();

    const input = screen.getByTestId("input");

    await user.click(input);
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("chip-cherry")).toHaveFocus();

    await user.click(input);
    expect(input).toHaveFocus();

    await user.keyboard("{Backspace}");

    expect(handleValueChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls[0][0]).toEqual(["apple", "banana"]);
  });

  it("removes the last chip after leaving a chip and tabbing back to the input", async () => {
    const handleValueChange = vi.fn();
    const user = userEvent.setup();
    mount(() => (
      <div>
        <button type="button" data-testid="outside">
          outside
        </button>
        <ComboboxRoot multiple defaultValue={["apple", "banana", "cherry"]} onValueChange={handleValueChange}>
          <ComboboxChips>
            <ComboboxChip data-testid="chip-apple">apple</ComboboxChip>
            <ComboboxChip data-testid="chip-banana">banana</ComboboxChip>
            <ComboboxChip data-testid="chip-cherry">cherry</ComboboxChip>
            <ComboboxInput data-testid="input" />
          </ComboboxChips>
        </ComboboxRoot>
      </div>
    ));
    tick();

    const input = screen.getByTestId("input");
    const outside = screen.getByTestId("outside");

    await user.click(outside);
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("chip-cherry")).toHaveFocus();

    await user.click(outside);
    expect(outside).toHaveFocus();

    await user.tab();
    expect(input).toHaveFocus();

    await user.keyboard("{Backspace}");

    expect(handleValueChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls[0][0]).toEqual(["apple", "banana"]);
  });

  it("removes the last chip after tabbing from a chip back to the input", async () => {
    const handleValueChange = vi.fn();
    const user = userEvent.setup();
    mount(() => (
      <ComboboxRoot multiple open={false} defaultValue={["apple", "banana", "cherry"]} onValueChange={handleValueChange}>
        <ComboboxChips>
          <ComboboxValue>
            {(value) => (
              <>
                {(value() as Array<string>).map((item) => (
                  <ComboboxChip data-testid={item}>{item}</ComboboxChip>
                ))}
                <ComboboxInput data-testid="input" />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
      </ComboboxRoot>
    ));
    tick();

    const input = screen.getByTestId("input");

    await user.click(input);
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("cherry")).toHaveFocus();

    await user.tab();
    expect(input).toHaveFocus();

    await user.keyboard("{Backspace}");

    expect(handleValueChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls[0][0]).toEqual(["apple", "banana"]);
  });

  it("focuses the last chip with ArrowLeft after tabbing from a chip back to the input", async () => {
    const user = userEvent.setup();
    mount(() => (
      <ComboboxRoot multiple open={false} defaultValue={["apple", "banana", "cherry"]}>
        <ComboboxChips>
          <ComboboxValue>
            {(value) => (
              <>
                {(value() as Array<string>).map((item) => (
                  <ComboboxChip data-testid={item}>{item}</ComboboxChip>
                ))}
                <ComboboxInput data-testid="input" />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
      </ComboboxRoot>
    ));
    tick();

    const input = screen.getByTestId("input");
    const lastChip = screen.getByTestId("cherry");

    await user.click(input);
    await user.keyboard("{ArrowLeft}");
    expect(lastChip).toHaveFocus();

    await user.tab();
    expect(input).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(lastChip).toHaveFocus();
  });
});
