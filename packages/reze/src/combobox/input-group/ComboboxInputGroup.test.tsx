import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { fireEvent, screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { renderWithCombobox } from "../test-utils";
import { ComboboxInputGroup } from "./ComboboxInputGroup";

afterEach(cleanup);

describe("<Combobox.InputGroup />", () => {
  it("renders a group wrapper", () => {
    renderWithCombobox(() => <ComboboxInputGroup>content</ComboboxInputGroup>);
    tick();

    const group = screen.getByText("content");
    expect(group.tagName).toBe("DIV");
    expect(group).toHaveAttribute("role", "group");
    expect(group).not.toHaveAttribute("data-popup-open");
  });

  it("reflects the open state", () => {
    renderWithCombobox(() => <ComboboxInputGroup>content</ComboboxInputGroup>, {
      storeState: { open: true, mounted: true },
    });
    tick();

    expect(screen.getByText("content")).toHaveAttribute("data-popup-open", "");
  });

  it("shows a placeholder hook when nothing is selected", () => {
    renderWithCombobox(() => <ComboboxInputGroup>content</ComboboxInputGroup>);
    tick();

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
    tick();

    const group = screen.getByTestId("inner-input").parentElement!;
    fireEvent.mouseDown(group);
    tick();

    expect(harness.openCalls.length).toBe(1);
    expect(harness.openCalls[0]).toEqual({ open: true, reason: "input-press" });
  });

  it("does not open while disabled", () => {
    const { harness } = renderWithCombobox(() => <ComboboxInputGroup>content</ComboboxInputGroup>, {
      storeState: { disabled: true },
    });
    tick();

    fireEvent.mouseDown(screen.getByText("content"));
    tick();

    expect(harness.openCalls.length).toBe(0);
    expect(screen.getByText("content")).toHaveAttribute("data-disabled");
  });

  it("ignores mousedowns on interactive children", () => {
    const { harness } = renderWithCombobox(() => (
      <ComboboxInputGroup>
        <button type="button">action</button>
      </ComboboxInputGroup>
    ));
    tick();

    fireEvent.mouseDown(screen.getByRole("button"));
    tick();

    expect(harness.openCalls.length).toBe(0);
  });

  it("throws a descriptive error when rendered outside <Combobox.Root>", () => {
    expect(() => {
      mount(() => <ComboboxInputGroup>content</ComboboxInputGroup>);
      tick();
    }).toThrow(/ComboboxRootContext is missing/);
  });
});
