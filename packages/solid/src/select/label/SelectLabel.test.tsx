import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { SelectRoot } from "../root/SelectRoot";
import { SelectTrigger } from "../trigger/SelectTrigger";
import { SelectLabel } from "./SelectLabel";

describe("<Select.Label />", () => {
  it("renders a div whose id derives from the root id", () => {
    render(() => (
      <SelectRoot id="country">
        <SelectLabel>Country</SelectLabel>
        <SelectTrigger>Choose</SelectTrigger>
      </SelectRoot>
    ));
    flush();

    const label = screen.getByText("Country");
    expect(label.tagName).toBe("DIV");
    expect(label.getAttribute("id")).toBe("country-label");
  });

  it("links the trigger back through aria-labelledby", () => {
    render(() => (
      <SelectRoot id="country">
        <SelectLabel>Country</SelectLabel>
        <SelectTrigger>Choose</SelectTrigger>
      </SelectRoot>
    ));
    flush();

    const trigger = screen.getByRole("combobox");
    expect(trigger.getAttribute("aria-labelledby")).toContain("country-label");
  });

  it("moves focus to the trigger when the label is clicked", () => {
    render(() => (
      <SelectRoot id="country">
        <SelectLabel>Country</SelectLabel>
        <SelectTrigger>Choose</SelectTrigger>
      </SelectRoot>
    ));
    flush();

    fireEvent.click(screen.getByText("Country"));
    flush();
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("throws a descriptive error when rendered outside <Select.Root>", () => {
    expect(() => {
      render(() => <SelectLabel>Country</SelectLabel>);
      flush();
    }).toThrow(/SelectRootContext is missing/);
  });
});
