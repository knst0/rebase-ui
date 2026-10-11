import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { fireEvent, screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { ComboboxChip } from "../chip/ComboboxChip";
import { ComboboxChips } from "../chips/ComboboxChips";
import { ComboboxInput } from "../input/ComboboxInput";
import { ComboboxRoot } from "../root/ComboboxRoot";
import { ComboboxChipRemove } from "./ComboboxChipRemove";

afterEach(cleanup);

function renderRemoves(rootProps: Record<string, unknown> = {}) {
  return mount(() => (
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
    tick();

    const remove = screen.getByTestId("remove-apple");
    expect(remove.tagName).toBe("BUTTON");
    expect(remove).toHaveAttribute("tabindex", "-1");
  });

  it("removes the chip on click and focuses the input", () => {
    const handleValueChange = vi.fn();
    renderRemoves({ onValueChange: handleValueChange });
    tick();

    fireEvent.click(screen.getByTestId("remove-apple"));
    tick();

    expect(handleValueChange).toHaveBeenCalledWith(["banana"], expect.anything());
    expect(screen.getByTestId("input")).toHaveFocus();
  });

  it("removes the chip once on Enter", () => {
    const handleValueChange = vi.fn();
    renderRemoves({ onValueChange: handleValueChange });
    tick();

    fireEvent.keyDown(screen.getByTestId("remove-apple"), { key: "Enter" });
    tick();
    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange).toHaveBeenCalledWith(["banana"], expect.anything());
  });

  it("removes the chip once on Space", () => {
    const handleValueChange = vi.fn();
    renderRemoves({ onValueChange: handleValueChange });
    tick();

    fireEvent.keyDown(screen.getByTestId("remove-banana"), { key: " " });
    tick();
    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange).toHaveBeenCalledWith(["apple"], expect.anything());
  });

  it("renders aria-disabled and keeps the chip when disabled", () => {
    const handleValueChange = vi.fn();
    renderRemoves({ disabled: true, onValueChange: handleValueChange });
    tick();

    const remove = screen.getByTestId("remove-apple");
    expect(remove).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(remove);
    tick();

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("chip-apple")).toBeInTheDocument();
  });

  it("keeps the chip when read-only", () => {
    const handleValueChange = vi.fn();
    renderRemoves({ readOnly: true, onValueChange: handleValueChange });
    tick();

    fireEvent.click(screen.getByTestId("remove-apple"));
    tick();

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("chip-apple")).toBeInTheDocument();
  });
});
