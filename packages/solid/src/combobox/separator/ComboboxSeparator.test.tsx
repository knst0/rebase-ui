import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { ComboboxSeparator } from "./ComboboxSeparator";

describe("<Combobox.Separator />", () => {
  it("renders a separator with the horizontal orientation by default", () => {
    render(() => <ComboboxSeparator data-testid="separator" />);
    flush();

    const separator = screen.getByTestId("separator");
    expect(separator).toHaveAttribute("role", "separator");
    expect(separator).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("renders a vertical separator when specified", () => {
    render(() => <ComboboxSeparator data-testid="separator" orientation="vertical" />);
    flush();

    expect(screen.getByTestId("separator")).toHaveAttribute("aria-orientation", "vertical");
  });
});
