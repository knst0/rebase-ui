import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import type { JSX } from "@solidjs/web";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { ComboboxChips } from "../chips/ComboboxChips";
import { ComboboxInput } from "../input/ComboboxInput";
import { ComboboxRoot } from "../root/ComboboxRoot";
import { ComboboxChip } from "./ComboboxChip";

function renderChips(rootProps: Record<string, unknown> = {}, chips: () => JSX.Element) {
  return render(() => (
    <ComboboxRoot multiple {...rootProps}>
      <ComboboxInput data-testid="input" />
      <ComboboxChips>{chips()}</ComboboxChips>
    </ComboboxRoot>
  ));
}

describe("<Combobox.Chip />", () => {
  it("renders a div element", () => {
    renderChips({}, () => <ComboboxChip data-testid="chip">apple</ComboboxChip>);
    flush();

    expect(screen.getByTestId("chip").tagName).toBe("DIV");
  });

  it("renders aria-disabled when the combobox is disabled", () => {
    renderChips({ disabled: true }, () => <ComboboxChip data-testid="chip">apple</ComboboxChip>);
    flush();

    expect(screen.getByTestId("chip")).toHaveAttribute("aria-disabled", "true");
  });

  it("renders aria-readonly when the combobox is read-only", () => {
    renderChips({ readOnly: true }, () => <ComboboxChip data-testid="chip">apple</ComboboxChip>);
    flush();

    expect(screen.getByTestId("chip")).toHaveAttribute("aria-readonly", "true");
  });

  it("navigates between chips with arrow keys and returns to the input at the ends", () => {
    renderChips({ defaultValue: ["apple", "banana", "cherry"] }, () => (
      <>
        <ComboboxChip data-testid="chip-apple">apple</ComboboxChip>
        <ComboboxChip data-testid="chip-banana">banana</ComboboxChip>
        <ComboboxChip data-testid="chip-cherry">cherry</ComboboxChip>
      </>
    ));
    flush();

    const chipApple = screen.getByTestId("chip-apple");
    const chipBanana = screen.getByTestId("chip-banana");
    const chipCherry = screen.getByTestId("chip-cherry");
    const input = screen.getByTestId("input");

    chipApple.focus();
    fireEvent.keyDown(chipApple, { key: "ArrowRight" });
    flush();
    expect(chipBanana).toHaveFocus();

    fireEvent.keyDown(chipBanana, { key: "ArrowRight" });
    flush();
    expect(chipCherry).toHaveFocus();

    fireEvent.keyDown(chipCherry, { key: "ArrowRight" });
    flush();
    expect(input).toHaveFocus();

    chipApple.focus();
    fireEvent.keyDown(chipApple, { key: "ArrowLeft" });
    flush();
    expect(input).toHaveFocus();
  });

  it("mirrors chip keyboard navigation in RTL mode", () => {
    document.documentElement.dir = "rtl";
    try {
      renderChips({ defaultValue: ["apple", "banana"] }, () => (
        <>
          <ComboboxChip data-testid="chip-apple">apple</ComboboxChip>
          <ComboboxChip data-testid="chip-banana">banana</ComboboxChip>
        </>
      ));
      flush();

      const chipApple = screen.getByTestId("chip-apple");
      const chipBanana = screen.getByTestId("chip-banana");

      chipApple.focus();
      fireEvent.keyDown(chipApple, { key: "ArrowLeft" });
      flush();
      expect(chipBanana).toHaveFocus();

      fireEvent.keyDown(chipBanana, { key: "ArrowRight" });
      flush();
      expect(chipApple).toHaveFocus();
    } finally {
      document.documentElement.dir = "";
    }
  });

  it("returns focus to the input for activation and text entry keys", () => {
    renderChips({ defaultValue: ["apple"] }, () => <ComboboxChip data-testid="chip">apple</ComboboxChip>);
    flush();

    const chip = screen.getByTestId("chip");
    const input = screen.getByTestId("input");

    for (const key of ["Enter", " ", "a"]) {
      chip.focus();
      fireEvent.keyDown(chip, { key });
      flush();
      expect(input).toHaveFocus();
    }
  });

  it("keeps focus on the chip for modified printable keys", () => {
    renderChips({ defaultValue: ["apple"] }, () => <ComboboxChip data-testid="chip">apple</ComboboxChip>);
    flush();

    const chip = screen.getByTestId("chip");

    for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      chip.focus();
      fireEvent.keyDown(chip, { key: "a", ...modifiers });
      flush();
      expect(chip).toHaveFocus();
    }
  });

  it("removes the chip on Backspace", () => {
    const handleValueChange = vi.fn();
    renderChips({ defaultValue: ["apple", "banana"], onValueChange: handleValueChange }, () => (
      <>
        <ComboboxChip data-testid="chip-apple">apple</ComboboxChip>
        <ComboboxChip data-testid="chip-banana">banana</ComboboxChip>
      </>
    ));
    flush();

    const chipApple = screen.getByTestId("chip-apple");
    chipApple.focus();
    fireEvent.keyDown(chipApple, { key: "Backspace" });
    flush();
    expect(handleValueChange).toHaveBeenCalledWith(["banana"], expect.anything());
  });

  it("removes the chip on Delete", () => {
    const handleValueChange = vi.fn();
    renderChips({ defaultValue: ["apple", "banana"], onValueChange: handleValueChange }, () => (
      <>
        <ComboboxChip data-testid="chip-apple">apple</ComboboxChip>
        <ComboboxChip data-testid="chip-banana">banana</ComboboxChip>
      </>
    ));
    flush();

    const chipApple = screen.getByTestId("chip-apple");
    chipApple.focus();
    fireEvent.keyDown(chipApple, { key: "Delete" });
    flush();
    expect(handleValueChange).toHaveBeenCalledWith(["banana"], expect.anything());
  });

  it("prevents navigation and deletion when disabled", () => {
    const handleValueChange = vi.fn();
    renderChips({ disabled: true, defaultValue: ["apple", "banana"], onValueChange: handleValueChange }, () => (
      <>
        <ComboboxChip data-testid="chip-apple">apple</ComboboxChip>
        <ComboboxChip data-testid="chip-banana">banana</ComboboxChip>
      </>
    ));
    flush();

    const chipApple = screen.getByTestId("chip-apple");
    chipApple.focus();
    fireEvent.keyDown(chipApple, { key: "ArrowRight" });
    flush();
    expect(chipApple).toHaveFocus();

    fireEvent.keyDown(chipApple, { key: "Backspace" });
    flush();
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it("prevents navigation and deletion when read-only", () => {
    const handleValueChange = vi.fn();
    renderChips({ readOnly: true, defaultValue: ["apple", "banana"], onValueChange: handleValueChange }, () => (
      <>
        <ComboboxChip data-testid="chip-apple">apple</ComboboxChip>
        <ComboboxChip data-testid="chip-banana">banana</ComboboxChip>
      </>
    ));
    flush();

    const chipApple = screen.getByTestId("chip-apple");
    chipApple.focus();
    fireEvent.keyDown(chipApple, { key: "ArrowRight" });
    flush();
    expect(chipApple).toHaveFocus();

    fireEvent.keyDown(chipApple, { key: "Delete" });
    flush();
    expect(handleValueChange).not.toHaveBeenCalled();
  });
});
