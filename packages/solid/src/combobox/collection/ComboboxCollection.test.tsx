import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { ComboboxGroup } from "../group/ComboboxGroup";
import { ComboboxInput } from "../input/ComboboxInput";
import { ComboboxItem } from "../item/ComboboxItem";
import { ComboboxList } from "../list/ComboboxList";
import { ComboboxPopup } from "../popup/ComboboxPopup";
import { ComboboxPortal } from "../portal/ComboboxPortal";
import { ComboboxPositioner } from "../positioner/ComboboxPositioner";
import { ComboboxRoot } from "../root/ComboboxRoot";
import { ComboboxCollection } from "./ComboboxCollection";

describe("<Combobox.Collection />", () => {
  it("renders filtered items", () => {
    render(() => (
      <ComboboxRoot defaultOpen items={["a", "b"]}>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxCollection>
                  {(item: unknown) => <ComboboxItem value={item}>{String(item)}</ComboboxItem>}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    flush();

    expect(screen.getByRole("option", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "b" })).toBeInTheDocument();
  });

  it("renders only items matching the input query", () => {
    render(() => (
      <ComboboxRoot defaultOpen defaultInputValue="b" items={["a", "b", "c"]}>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxCollection>
                  {(item: unknown) => <ComboboxItem value={item}>{String(item)}</ComboboxItem>}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    flush();

    expect(screen.queryByRole("option", { name: "a" })).toBe(null);
    expect(screen.getByRole("option", { name: "b" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "c" })).toBe(null);
  });

  it("renders nothing when a nested group does not provide items", () => {
    render(() => (
      <ComboboxRoot defaultOpen>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxGroup data-testid="group">
                  <ComboboxCollection>
                    {(item: unknown) => <span>{String(item)}</span>}
                  </ComboboxCollection>
                </ComboboxGroup>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    flush();

    expect(screen.getByTestId("group")).toBeEmptyDOMElement();
  });
});
