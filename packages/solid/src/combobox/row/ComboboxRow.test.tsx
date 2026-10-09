import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { ComboboxInput } from "../input/ComboboxInput";
import { ComboboxItem } from "../item/ComboboxItem";
import { ComboboxList } from "../list/ComboboxList";
import { ComboboxPopup } from "../popup/ComboboxPopup";
import { ComboboxPortal } from "../portal/ComboboxPortal";
import { ComboboxPositioner } from "../positioner/ComboboxPositioner";
import { ComboboxRoot } from "../root/ComboboxRoot";
import { ComboboxRow } from "./ComboboxRow";
import { useComboboxRowContext } from "./ComboboxRowContext";

describe("<Combobox.Row />", () => {
  it("is false outside a row", () => {
    let seen: boolean | undefined;
    function Probe() {
      seen = useComboboxRowContext();
      return null;
    }
    render(() => <Probe />);
    flush();
    expect(seen).toBe(false);
  });

  it("renders a row with gridcell items in grid mode", () => {
    render(() => (
      <ComboboxRoot defaultOpen grid>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxRow data-testid="row">
                  <ComboboxItem value="a">a</ComboboxItem>
                  <ComboboxItem value="b">b</ComboboxItem>
                </ComboboxRow>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    flush();
    expect(screen.getByTestId("row")).toHaveAttribute("role", "row");
    expect(screen.getByRole("gridcell", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "b" })).toBeInTheDocument();
    expect(screen.queryByRole("option")).toBe(null);
  });
  it("renders gridcell items in a row outside grid mode", () => {
    render(() => (
      <ComboboxRoot defaultOpen>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxRow>
                  <ComboboxItem value="a">a</ComboboxItem>
                </ComboboxRow>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    flush();

    expect(screen.getByRole("row")).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "a" })).toBeInTheDocument();
  });
});
