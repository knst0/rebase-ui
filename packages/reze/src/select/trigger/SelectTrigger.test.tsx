import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import { SelectLabel } from "../label/SelectLabel";
import { SelectRoot } from "../root/SelectRoot";
import { SelectTrigger } from "./SelectTrigger";

afterEach(cleanup);

function renderTrigger(triggerProps: Record<string, unknown> = {}, rootProps: Record<string, unknown> = {}) {
  return mount(() => (
    <SelectRoot {...rootProps}>
      <SelectTrigger {...triggerProps}>Choose</SelectTrigger>
    </SelectRoot>
  ));
}

describe("<Select.Trigger />", () => {
  it("renders closed combobox semantics with a placeholder hook", () => {
    renderTrigger();
    tick();

    const trigger = screen.getByRole("combobox");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("tabindex", "0");
    expect(trigger).toHaveAttribute("data-placeholder");
    expect(trigger).not.toHaveAttribute("data-popup-open");
    expect(trigger).not.toHaveAttribute("aria-controls");
  });

  it("opens and closes the popup on click", async () => {
    renderTrigger();
    tick();

    const trigger = screen.getByRole("combobox");

    fire(trigger, "click");
    tick();
    await nextFrames();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("data-popup-open");

    fire(trigger, "click");
    tick();
    await nextFrames();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("data-popup-open");
  });

  it("reflects a controlled open value", () => {
    renderTrigger({}, { open: true });
    tick();

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("data-popup-open");
  });

  it("marks the pressed hook while the pointer is held down", () => {
    renderTrigger();
    tick();

    const trigger = screen.getByRole("combobox");
    fire(trigger, "pointerdown");
    tick();
    expect(trigger).toHaveAttribute("data-pressed");

    fire(trigger, "pointerup");
    tick();
    expect(trigger).not.toHaveAttribute("data-pressed");
  });

  it("does not open while disabled and exposes disabled semantics", async () => {
    renderTrigger({ disabled: true });
    tick();

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("data-disabled");
    expect(trigger).toHaveAttribute("tabindex", "-1");

    fire(trigger, "click");
    tick();
    await nextFrames();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("data-popup-open");
  });

  it("forwards readonly and required hooks to aria attributes", () => {
    renderTrigger({}, { readOnly: true, required: true });
    tick();

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-readonly", "true");
    expect(trigger).toHaveAttribute("aria-required", "true");
    expect(trigger).toHaveAttribute("data-required");
  });

  it("associates the label through aria-labelledby", () => {
    mount(() => (
      <SelectRoot id="country">
        <SelectLabel>Country</SelectLabel>
        <SelectTrigger>Choose</SelectTrigger>
      </SelectRoot>
    ));
    tick();

    const trigger = screen.getByRole("combobox");
    const labelledBy = trigger.getAttribute("aria-labelledby") ?? "";
    expect(labelledBy).toContain("country-label");
    expect(screen.getByText("Country").getAttribute("id")).toBe("country-label");
  });

  it("throws a descriptive error when rendered outside <Select.Root>", () => {
    expect(() => {
      mount(() => <SelectTrigger>Choose</SelectTrigger>);
      tick();
    }).toThrow(/SelectRootContext is missing/);
  });
});
