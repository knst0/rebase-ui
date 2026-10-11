import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { ComboboxCollection } from "../collection/ComboboxCollection";
import { ComboboxGroupLabel } from "../group-label/ComboboxGroupLabel";
import { ComboboxInput } from "../input/ComboboxInput";
import { ComboboxItem } from "../item/ComboboxItem";
import { ComboboxList } from "../list/ComboboxList";
import { ComboboxPopup } from "../popup/ComboboxPopup";
import { ComboboxPortal } from "../portal/ComboboxPortal";
import { ComboboxPositioner } from "../positioner/ComboboxPositioner";
import { ComboboxRoot } from "../root/ComboboxRoot";
import { ComboboxGroup } from "./ComboboxGroup";
import { useComboboxGroupContext } from "./ComboboxGroupContext";

afterEach(cleanup);

describe("<Combobox.Group />", () => {
  it("throws a descriptive error when the context is used outside <Combobox.Group>", () => {
    function Probe() {
      useComboboxGroupContext();
      return null;
    }
    expect(() => {
      mount(() => <Probe />);
      tick();
    }).toThrow("Rebase UI: ComboboxGroupContext is missing. ComboboxGroup parts must be placed within <Combobox.Group>");
  });

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
    expect(group).toHaveAttribute("aria-labelledby", label.id);
  });

  it("renders as a rowgroup when the root is a grid", () => {
    mount(() => (
      <ComboboxRoot defaultOpen grid>
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

    expect(screen.getByRole("rowgroup")).toBeInTheDocument();
    expect(screen.queryByRole("group")).toBe(null);
  });

  it("scopes a nested collection to the group items", () => {
    mount(() => (
      <ComboboxRoot defaultOpen>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxGroup items={["a", "b"]}>
                  <ComboboxGroupLabel>Fruits</ComboboxGroupLabel>
                  <ComboboxCollection>{(item: unknown) => <ComboboxItem value={item}>{String(item)}</ComboboxItem>}</ComboboxCollection>
                </ComboboxGroup>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    tick();

    expect(screen.getByRole("option", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "b" })).toBeInTheDocument();
  });
});
