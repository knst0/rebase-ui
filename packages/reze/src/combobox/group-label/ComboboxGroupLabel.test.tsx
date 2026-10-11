import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { ComboboxGroup } from "../group/ComboboxGroup";
import { ComboboxInput } from "../input/ComboboxInput";
import { ComboboxItem } from "../item/ComboboxItem";
import { ComboboxList } from "../list/ComboboxList";
import { ComboboxPopup } from "../popup/ComboboxPopup";
import { ComboboxPortal } from "../portal/ComboboxPortal";
import { ComboboxPositioner } from "../positioner/ComboboxPositioner";
import { ComboboxRoot } from "../root/ComboboxRoot";
import { ComboboxGroupLabel } from "./ComboboxGroupLabel";

afterEach(cleanup);

describe("<Combobox.GroupLabel />", () => {
  it("associates the label with its parent group", () => {
    mount(() => (
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
    tick();

    const group = screen.getByRole("group");
    const label = screen.getByText("Fruits");

    expect(label.id).not.toBe("");
    expect(label).toHaveAttribute("aria-hidden", "true");
    expect(group).toHaveAttribute("aria-labelledby", label.id);
  });

  it("uses an explicit id when provided", () => {
    mount(() => (
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
    tick();

    expect(screen.getByRole("group")).toHaveAttribute("aria-labelledby", "fruits-label");
  });
});
