import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { ComboboxChip } from "../chip/ComboboxChip";
import { ComboboxChips } from "../chips/ComboboxChips";
import { ComboboxInput } from "../input/ComboboxInput";
import { ComboboxRoot } from "../root/ComboboxRoot";
import { ComboboxChipRemove } from "./ComboboxChipRemove";

function renderRemoves(rootProps: Record<string, unknown> = {}) {
  return render(() => (
    <ComboboxRoot multiple defaultValue={["apple", "banana"]} {...rootProps}>
      <ComboboxInput data-testid="input" />
      <ComboboxChips>
        <ComboboxChip data-testid="chip-apple">
          apple
          <ComboboxChipRemove data-testid="remove-apple">×</ComboboxChipRemove>
        </ComboboxChip>
        <ComboboxChip data-testid="chip-banana">
          banana
          <ComboboxChipRemove data-testid="remove-banana">×</ComboboxChipRemove>
        </ComboboxChip>
      </ComboboxChips>
    </ComboboxRoot>
  ));
}

describe("<Combobox.ChipRemove />", () => {
  it("renders a button element that is not in the tab order", () => {
    renderRemoves();
    flush();

    const remove = screen.getByTestId("remove-apple");
    expect(remove.tagName).toBe("BUTTON");
    expect(remove).toHaveAttribute("tabindex", "-1");
  });

  it("throws a descriptive error when rendered outside <Combobox.Chip>", () => {
    expect(() => {
      render(() => (
        <ComboboxRoot multiple>
          <ComboboxChips>
            <ComboboxChipRemove />
          </ComboboxChips>
        </ComboboxRoot>
      ));
      flush();
    }).toThrow(/ComboboxChipContext is missing/);
  });

  it("removes the chip on click and focuses the input", () => {
    const handleValueChange = vi.fn();
    renderRemoves({ onValueChange: handleValueChange });
    flush();

    fireEvent.click(screen.getByTestId("remove-apple"));
    flush();

    expect(handleValueChange).toHaveBeenCalledWith(["banana"], expect.anything());
    expect(screen.getByTestId("input")).toHaveFocus();
  });

  it("removes the chip once on Enter", () => {
    const handleValueChange = vi.fn();
    renderRemoves({ onValueChange: handleValueChange });
    flush();

    fireEvent.keyDown(screen.getByTestId("remove-apple"), { key: "Enter" });
    flush();
    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange).toHaveBeenCalledWith(["banana"], expect.anything());
  });

  it("removes the chip once on Space", () => {
    const handleValueChange = vi.fn();
    renderRemoves({ onValueChange: handleValueChange });
    flush();

    fireEvent.keyDown(screen.getByTestId("remove-banana"), { key: " " });
    flush();
    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange).toHaveBeenCalledWith(["apple"], expect.anything());
  });

  it("renders aria-disabled and keeps the chip when disabled", () => {
    const handleValueChange = vi.fn();
    renderRemoves({ disabled: true, onValueChange: handleValueChange });
    flush();

    const remove = screen.getByTestId("remove-apple");
    expect(remove).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(remove);
    flush();

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("chip-apple")).toBeInTheDocument();
  });

  it("keeps the chip when read-only", () => {
    const handleValueChange = vi.fn();
    renderRemoves({ readOnly: true, onValueChange: handleValueChange });
    flush();

    fireEvent.click(screen.getByTestId("remove-apple"));
    flush();

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("chip-apple")).toBeInTheDocument();
  });
});
