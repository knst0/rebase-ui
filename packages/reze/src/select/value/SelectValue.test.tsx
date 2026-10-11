import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { SelectRoot } from "../root/SelectRoot";
import { SelectValue } from "./SelectValue";

afterEach(cleanup);

const RECORD_ITEMS = { sans: "Sans-serif", serif: "Serif" };
const ARRAY_ITEMS = [
  { value: "sans", label: "Sans-serif" },
  { value: "serif", label: "Serif" },
];

function renderValue(valueProps: Record<string, unknown> = {}, rootProps: Record<string, unknown> = {}) {
  return mount(() => (
    <SelectRoot {...rootProps}>
      <SelectValue {...valueProps} />
    </SelectRoot>
  ));
}

describe("<Select.Value />", () => {
  it("renders the placeholder with a placeholder hook when nothing is selected", () => {
    renderValue({ placeholder: "Pick a font" });
    tick();

    const value = screen.getByText("Pick a font");
    expect(value.tagName).toBe("SPAN");
    expect(value).toHaveAttribute("data-placeholder");
  });

  it("resolves the selected label from record items", () => {
    renderValue({ placeholder: "Pick a font" }, { value: "sans", items: RECORD_ITEMS });
    tick();

    const value = screen.getByText("Sans-serif");
    expect(value).not.toHaveAttribute("data-placeholder");
  });

  it("resolves the selected label from array items", () => {
    renderValue({}, { value: "serif", items: ARRAY_ITEMS });
    tick();

    expect(screen.getByText("Serif")).toBeInTheDocument();
  });

  it("joins multiple labels with a separator in multiple mode", () => {
    renderValue({}, { multiple: true, value: ["sans", "serif"], items: RECORD_ITEMS });
    tick();

    expect(screen.getByText("Sans-serif, Serif")).toBeInTheDocument();
  });

  it("accepts a render function receiving the value", () => {
    renderValue(
      { children: (value: unknown) => (value ? `Selected: ${String(value)}` : "Nothing") },
      { value: "sans", items: RECORD_ITEMS },
    );
    tick();

    expect(screen.getByText("Selected: sans")).toBeInTheDocument();
  });

  it("lets explicit children override the resolved label", () => {
    renderValue({ children: "Custom" }, { value: "sans", items: RECORD_ITEMS });
    tick();

    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("throws a descriptive error when rendered outside <Select.Root>", () => {
    expect(() => {
      mount(() => <SelectValue placeholder="Pick" />);
      tick();
    }).toThrow(/SelectRootContext is missing/);
  });
});
