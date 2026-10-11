import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { fireEvent, screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { ComboboxChip } from "../chip/ComboboxChip";
import { ComboboxInput } from "../input/ComboboxInput";
import { ComboboxRoot } from "../root/ComboboxRoot";
import { ComboboxChips } from "./ComboboxChips";

afterEach(cleanup);

function renderChips(chipsProps: Record<string, unknown> = {}, rootProps: Record<string, unknown> = {}) {
  return mount(() => (
    <ComboboxRoot multiple {...rootProps}>
      <ComboboxChips {...chipsProps} />
    </ComboboxRoot>
  ));
}

describe("<Combobox.Chips />", () => {
  it("renders a div element", () => {
    renderChips({ "data-testid": "chips" });
    tick();

    expect(screen.getByTestId("chips").tagName).toBe("DIV");
  });

  it('does not set role="toolbar" when there are no chips', () => {
    renderChips({ "data-testid": "chips" });
    tick();

    expect(screen.getByTestId("chips")).not.toHaveAttribute("role");
  });

  it('sets role="toolbar" when there is at least one chip', () => {
    mount(() => (
      <ComboboxRoot multiple defaultValue={["apple"]}>
        <ComboboxChips data-testid="chips">
          <ComboboxChip>apple</ComboboxChip>
        </ComboboxChips>
      </ComboboxRoot>
    ));
    tick();

    expect(screen.getByTestId("chips")).toHaveAttribute("role", "toolbar");
  });

  it("focuses the input when pressing anywhere in the chips area", () => {
    mount(() => (
      <ComboboxRoot multiple defaultValue={["apple"]}>
        <ComboboxChips data-testid="chips">
          <ComboboxChip data-testid="chip">apple</ComboboxChip>
          <ComboboxInput data-testid="input" />
        </ComboboxChips>
      </ComboboxRoot>
    ));
    tick();

    const chips = screen.getByTestId("chips");
    const input = screen.getByTestId("input");

    expect(input).not.toHaveFocus();

    fireEvent.mouseDown(chips);
    tick();
    expect(input).toHaveFocus();

    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.mouseDown(screen.getByTestId("chip"));
    tick();
    expect(input).toHaveFocus();
  });

  it("throws a descriptive error when rendered outside <Combobox.Root>", () => {
    expect(() => {
      mount(() => <ComboboxChips />);
      tick();
    }).toThrow(/ComboboxRootContext is missing/);
  });
});
