import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { renderWithCombobox } from "../test-utils";
import { ComboboxInputGroup } from "./ComboboxInputGroup";

describe("<Combobox.InputGroup />", () => {
  it("renders a group wrapper", () => {
    renderWithCombobox(() => <ComboboxInputGroup>content</ComboboxInputGroup>);
    flush();

    const group = screen.getByText("content");
    expect(group.tagName).toBe("DIV");
    expect(group).toHaveAttribute("role", "group");
    expect(group).not.toHaveAttribute("data-popup-open");
  });

  it("reflects the open state", () => {
    renderWithCombobox(() => <ComboboxInputGroup>content</ComboboxInputGroup>, {
      storeState: { open: true, mounted: true },
    });
    flush();

    expect(screen.getByText("content")).toHaveAttribute("data-popup-open", "");
  });

  it("shows a placeholder hook when nothing is selected", () => {
    renderWithCombobox(() => <ComboboxInputGroup>content</ComboboxInputGroup>);
    flush();

    expect(screen.getByText("content")).toHaveAttribute("data-placeholder");
  });

  it("focuses the input and opens on mousedown", () => {
    const { harness } = renderWithCombobox(
      () => (
        <ComboboxInputGroup>
          <input data-testid="inner-input" />
        </ComboboxInputGroup>
      ),
      { storeState: { openOnInputClick: true } },
    );
    flush();

    const group = screen.getByTestId("inner-input").parentElement!;
    fireEvent.mouseDown(group);
    flush();

    expect(harness.openCalls.length).toBe(1);
    expect(harness.openCalls[0]).toEqual({ open: true, reason: "input-press" });
  });

  it("does not open while disabled", () => {
    const { harness } = renderWithCombobox(() => <ComboboxInputGroup>content</ComboboxInputGroup>, {
      storeState: { disabled: true },
    });
    flush();

    fireEvent.mouseDown(screen.getByText("content"));
    flush();

    expect(harness.openCalls.length).toBe(0);
    expect(screen.getByText("content")).toHaveAttribute("data-disabled");
  });

  it("ignores mousedowns on interactive children", () => {
    const { harness } = renderWithCombobox(() => (
      <ComboboxInputGroup>
        <button type="button">action</button>
      </ComboboxInputGroup>
    ));
    flush();

    fireEvent.mouseDown(screen.getByRole("button"));
    flush();

    expect(harness.openCalls.length).toBe(0);
  });

  it("throws a descriptive error when rendered outside <Combobox.Root>", () => {
    expect(() => {
      render(() => <ComboboxInputGroup>content</ComboboxInputGroup>);
      flush();
    }).toThrow(/ComboboxRootContext is missing/);
  });
});
