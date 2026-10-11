import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { ComboboxSeparator } from "./ComboboxSeparator";

afterEach(cleanup);

describe("<Combobox.Separator />", () => {
  it("renders a separator with the horizontal orientation by default", () => {
    mount(() => <ComboboxSeparator data-testid="separator" />);
    tick();

    const separator = screen.getByTestId("separator");
    expect(separator).toHaveAttribute("role", "separator");
    expect(separator).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("renders a vertical separator when specified", () => {
    mount(() => <ComboboxSeparator data-testid="separator" orientation="vertical" />);
    tick();

    expect(screen.getByTestId("separator")).toHaveAttribute("aria-orientation", "vertical");
  });
});
