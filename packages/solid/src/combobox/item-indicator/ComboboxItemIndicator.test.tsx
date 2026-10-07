import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { ComboboxItemContext } from "../item/ComboboxItemContext";
import { ComboboxItemIndicator } from "./ComboboxItemIndicator";

function renderIndicator(selected: boolean, props?: Record<string, unknown>) {
  render(() => (
    <ComboboxItemContext value={{ selected: () => selected, textRef: { current: null } }}>
      <ComboboxItemIndicator data-testid="indicator" {...props} />
    </ComboboxItemContext>
  ));
  flush();
}

describe("<Combobox.ItemIndicator />", () => {
  it("renders when the item is selected", () => {
    renderIndicator(true);

    const indicator = screen.getByTestId("indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("aria-hidden", "true");
  });

  it("renders nothing when the item is not selected", () => {
    renderIndicator(false);

    expect(screen.queryByTestId("indicator")).toBe(null);
  });

  it("stays mounted with keepMounted when the item is not selected", () => {
    renderIndicator(false, { keepMounted: true });

    expect(screen.getByTestId("indicator")).toBeInTheDocument();
  });
});
