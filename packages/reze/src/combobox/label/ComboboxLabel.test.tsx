import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { renderWithCombobox } from "../test-utils";
import { ComboboxLabel } from "./ComboboxLabel";

afterEach(cleanup);

describe("<Combobox.Label />", () => {
  it("renders with an id derived from the root id", () => {
    renderWithCombobox(() => <ComboboxLabel>Font</ComboboxLabel>);
    tick();

    const label = screen.getByText("Font");
    expect(label.tagName).toBe("DIV");
    expect(label).toHaveAttribute("id", "test-combobox-label");
  });

  it("throws a descriptive error when rendered outside <Combobox.Root>", () => {
    expect(() => {
      mount(() => <ComboboxLabel>Font</ComboboxLabel>);
      tick();
    }).toThrow(/ComboboxRootContext is missing/);
  });
});
