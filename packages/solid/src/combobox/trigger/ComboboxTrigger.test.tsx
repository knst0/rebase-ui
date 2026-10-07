import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { renderWithCombobox } from "../test-utils";
import { ComboboxTrigger } from "./ComboboxTrigger";

function renderTrigger(triggerProps: Record<string, unknown> = {}, harnessOptions: Record<string, unknown> = {}) {
  return renderWithCombobox(() => <ComboboxTrigger {...triggerProps}>Open</ComboboxTrigger>, harnessOptions);
}

describe("<Combobox.Trigger />", () => {
  it("renders closed semantics with a placeholder hook", () => {
    renderTrigger();
    flush();

    const trigger = screen.getByRole("button", { name: "Open" });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).not.toHaveAttribute("role", "combobox");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("tabindex", "-1");
    expect(trigger).toHaveAttribute("data-placeholder");
    expect(trigger).not.toHaveAttribute("data-popup-open");
    expect(trigger).not.toHaveAttribute("aria-controls");
  });

  it("opens the popup on mousedown", () => {
    const { harness } = renderTrigger();
    flush();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Open" }));
    flush();

    expect(harness.openCalls).toEqual([{ open: true, reason: "trigger-press" }]);
    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("data-popup-open", "");
  });

  it("closes the popup on mousedown while open", () => {
    const { harness } = renderTrigger({}, { storeState: { open: true, mounted: true } });
    flush();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Open" }));
    flush();

    expect(harness.openCalls).toEqual([{ open: false, reason: "trigger-press" }]);
  });

  it("opens on ArrowDown and moves focus to the input", () => {
    const { harness } = renderTrigger();
    flush();

    const input = document.createElement("input");
    document.body.appendChild(input);
    harness.store.context.inputRef.current = input;
    try {
      fireEvent.keyDown(screen.getByRole("button", { name: "Open" }), { key: "ArrowDown" });
      flush();

      expect(harness.openCalls).toEqual([{ open: true, reason: "list-navigation" }]);
      expect(document.activeElement).toBe(input);
    } finally {
      input.remove();
    }
  });

  it("commits a typeahead match while closed in single mode", () => {
    const { harness } = renderTrigger();
    harness.store.context.labelsRef.current = ["Apple", "Banana"];
    harness.store.context.valuesRef.current = ["a", "b"];
    flush();

    fireEvent.keyDown(screen.getByRole("button", { name: "Open" }), { key: "b" });
    flush();

    expect(harness.selectedValueCalls).toEqual([{ value: "b", reason: "none" }]);
  });

  it("does not open while disabled", () => {
    const { harness } = renderTrigger({}, { storeState: { disabled: true } });
    flush();

    const trigger = screen.getByRole("button", { name: "Open" });
    fireEvent.mouseDown(trigger);
    flush();

    expect(harness.openCalls.length).toBe(0);
    expect(trigger).toHaveAttribute("data-disabled");
  });

  it("acts as the combobox control when the input is inside the popup", () => {
    renderTrigger({}, { storeState: { inputInsidePopup: true, id: "fruit", required: true, readOnly: true } });
    flush();

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("tabindex", "0");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-required", "true");
    expect(trigger).toHaveAttribute("aria-readonly", "true");
  });

  it("exposes aria-controls once open inside the popup", () => {
    renderTrigger({}, { storeState: { inputInsidePopup: true, id: "fruit", open: true, mounted: true } });
    flush();

    expect(screen.getByRole("combobox")).toHaveAttribute("aria-controls", "fruit-popup");
  });

  it("throws a descriptive error when rendered outside <Combobox.Root>", () => {
    expect(() => {
      render(() => <ComboboxTrigger>Open</ComboboxTrigger>);
      flush();
    }).toThrow(/ComboboxRootContext is missing/);
  });
});
