import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { SelectRoot } from "../root/SelectRoot";
import { SelectValue } from "./SelectValue";

const RECORD_ITEMS = { sans: "Sans-serif", serif: "Serif" };
const ARRAY_ITEMS = [
  { value: "sans", label: "Sans-serif" },
  { value: "serif", label: "Serif" },
];

function renderValue(valueProps: Record<string, unknown> = {}, rootProps: Record<string, unknown> = {}) {
  return render(() => (
    <SelectRoot {...rootProps}>
      <SelectValue {...valueProps} />
    </SelectRoot>
  ));
}

describe("<Select.Value />", () => {
  it("renders the placeholder with a placeholder hook when nothing is selected", () => {
    renderValue({ placeholder: "Pick a font" });
    flush();

    const value = screen.getByText("Pick a font");
    expect(value.tagName).toBe("SPAN");
    expect(value).toHaveAttribute("data-placeholder");
  });

  it("resolves the selected label from record items", () => {
    renderValue({ placeholder: "Pick a font" }, { value: "sans", items: RECORD_ITEMS });
    flush();

    const value = screen.getByText("Sans-serif");
    expect(value).not.toHaveAttribute("data-placeholder");
  });

  it("resolves the selected label from array items", () => {
    renderValue({}, { value: "serif", items: ARRAY_ITEMS });
    flush();

    expect(screen.getByText("Serif")).toBeInTheDocument();
  });

  it("joins multiple labels with a separator in multiple mode", () => {
    renderValue({}, { multiple: true, value: ["sans", "serif"], items: RECORD_ITEMS });
    flush();

    expect(screen.getByText("Sans-serif, Serif")).toBeInTheDocument();
  });

  it("accepts a render function receiving the value", () => {
    renderValue(
      { children: (value: unknown) => (value ? `Selected: ${String(value)}` : "Nothing") },
      { value: "sans", items: RECORD_ITEMS },
    );
    flush();

    expect(screen.getByText("Selected: sans")).toBeInTheDocument();
  });

  it("lets explicit children override the resolved label", () => {
    renderValue({ children: "Custom" }, { value: "sans", items: RECORD_ITEMS });
    flush();

    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("throws a descriptive error when rendered outside <Select.Root>", () => {
    expect(() => {
      render(() => <SelectValue placeholder="Pick" />);
      flush();
    }).toThrow(/SelectRootContext is missing/);
  });
});
