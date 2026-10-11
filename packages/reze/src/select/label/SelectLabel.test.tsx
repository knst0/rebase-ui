import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { SelectRoot } from "../root/SelectRoot";
import { SelectTrigger } from "../trigger/SelectTrigger";
import { SelectLabel } from "./SelectLabel";

afterEach(cleanup);

describe("<Select.Label />", () => {
  it("renders a div whose id derives from the root id", () => {
    mount(() => (
      <SelectRoot id="country">
        <SelectLabel>Country</SelectLabel>
        <SelectTrigger>Choose</SelectTrigger>
      </SelectRoot>
    ));
    tick();

    const label = screen.getByText("Country");
    expect(label.tagName).toBe("DIV");
    expect(label.getAttribute("id")).toBe("country-label");
  });

  it("links the trigger back through aria-labelledby", () => {
    mount(() => (
      <SelectRoot id="country">
        <SelectLabel>Country</SelectLabel>
        <SelectTrigger>Choose</SelectTrigger>
      </SelectRoot>
    ));
    tick();

    const trigger = screen.getByRole("combobox");
    expect(trigger.getAttribute("aria-labelledby")).toContain("country-label");
  });

  it("moves focus to the trigger when the label is clicked", () => {
    mount(() => (
      <SelectRoot id="country">
        <SelectLabel>Country</SelectLabel>
        <SelectTrigger>Choose</SelectTrigger>
      </SelectRoot>
    ));
    tick();

    fire(screen.getByText("Country"), "click");
    tick();
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("throws a descriptive error when rendered outside <Select.Root>", () => {
    expect(() => {
      mount(() => <SelectLabel>Country</SelectLabel>);
      tick();
    }).toThrow(/SelectRootContext is missing/);
  });
});
