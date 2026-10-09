import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { ComboboxGroup } from "../group/ComboboxGroup";
import { ComboboxInput } from "../input/ComboboxInput";
import { ComboboxItem } from "../item/ComboboxItem";
import { ComboboxList } from "../list/ComboboxList";
import { ComboboxPopup } from "../popup/ComboboxPopup";
import { ComboboxPortal } from "../portal/ComboboxPortal";
import { ComboboxPositioner } from "../positioner/ComboboxPositioner";
import { ComboboxRoot } from "../root/ComboboxRoot";
import { ComboboxGroupLabel } from "./ComboboxGroupLabel";

describe("<Combobox.GroupLabel />", () => {
  it("associates the label with its parent group", () => {
    render(() => (
      <ComboboxRoot defaultOpen>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxGroup>
                  <ComboboxGroupLabel>Fruits</ComboboxGroupLabel>
                  <ComboboxItem value="a">a</ComboboxItem>
                </ComboboxGroup>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    flush();

    const group = screen.getByRole("group");
    const label = screen.getByText("Fruits");

    expect(label.id).not.toBe("");
    expect(label).toHaveAttribute("aria-hidden", "true");
    expect(group).toHaveAttribute("aria-labelledby", label.id);
  });

  it("uses an explicit id when provided", () => {
    render(() => (
      <ComboboxRoot defaultOpen>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxGroup>
                  <ComboboxGroupLabel id="fruits-label">Fruits</ComboboxGroupLabel>
                  <ComboboxItem value="a">a</ComboboxItem>
                </ComboboxGroup>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    flush();

    expect(screen.getByRole("group")).toHaveAttribute("aria-labelledby", "fruits-label");
  });
});
