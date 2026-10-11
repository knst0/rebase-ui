import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { renderWithCombobox } from "../test-utils";
import { ComboboxValue } from "./ComboboxValue";

afterEach(cleanup);

const RECORD_ITEMS = { sans: "Sans-serif", serif: "Serif" };
const ARRAY_ITEMS = [
  { value: "sans", label: "Sans-serif" },
  { value: "serif", label: "Serif" },
];

function renderValue(valueProps: Record<string, unknown> = {}, harnessOptions: Record<string, unknown> = {}) {
  return renderWithCombobox(() => <ComboboxValue {...valueProps} />, harnessOptions);
}

describe("<Combobox.Value />", () => {
  it("renders the placeholder when nothing is selected", () => {
    renderValue({ placeholder: "Pick a font" });
    tick();

    expect(screen.getByText("Pick a font")).toBeInTheDocument();
  });

  it("resolves the selected label from record items", () => {
    renderValue({ placeholder: "Pick a font" }, { storeState: { selectedValue: "sans", items: RECORD_ITEMS } });
    tick();

    expect(screen.getByText("Sans-serif")).toBeInTheDocument();
    expect(screen.queryByText("Pick a font")).not.toBeInTheDocument();
  });

  it("resolves the selected label from array items", () => {
    renderValue({}, { storeState: { selectedValue: "serif", items: ARRAY_ITEMS } });
    tick();

    expect(screen.getByText("Serif")).toBeInTheDocument();
  });

  it("joins multiple labels in multiple mode", () => {
    renderValue(
      {},
      {
        storeState: {
          selectionMode: "multiple",
          selectedValue: ["sans", "serif"],
          items: RECORD_ITEMS,
        },
      },
    );
    tick();

    expect(screen.getByText("Sans-serif, Serif")).toBeInTheDocument();
  });

  it("accepts a render function receiving the value accessor", () => {
    renderValue(
      {
        children: (value: () => unknown) => <span>{value() ? `Selected: ${String(value())}` : "Nothing"}</span>,
      },
      { storeState: { selectedValue: "sans", items: RECORD_ITEMS } },
    );
    tick();

    expect(screen.getByText("Selected: sans")).toBeInTheDocument();
  });

  it("lets explicit children override the resolved label", () => {
    renderValue({ children: "Custom" }, { storeState: { selectedValue: "sans", items: RECORD_ITEMS } });
    tick();

    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("throws a descriptive error when rendered outside <Combobox.Root>", () => {
    expect(() => {
      mount(() => <ComboboxValue placeholder="Pick" />);
      tick();
    }).toThrow(/ComboboxRootContext is missing/);
  });
});
