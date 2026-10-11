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
import { ComboboxCollection } from "./ComboboxCollection";

afterEach(cleanup);

describe("<Combobox.Collection />", () => {
  it("renders filtered items", () => {
    mount(() => (
      <ComboboxRoot defaultOpen items={["a", "b"]}>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxCollection>{(item: unknown) => <ComboboxItem value={item}>{String(item)}</ComboboxItem>}</ComboboxCollection>
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

  it("renders only items matching the input query", () => {
    mount(() => (
      <ComboboxRoot defaultOpen defaultInputValue="b" items={["a", "b", "c"]}>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxCollection>{(item: unknown) => <ComboboxItem value={item}>{String(item)}</ComboboxItem>}</ComboboxCollection>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    tick();

    expect(screen.queryByRole("option", { name: "a" })).toBe(null);
    expect(screen.getByRole("option", { name: "b" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "c" })).toBe(null);
  });

  it("renders nothing when a nested group does not provide items", () => {
    mount(() => (
      <ComboboxRoot defaultOpen>
        <ComboboxInput />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                <ComboboxGroup data-testid="group">
                  <ComboboxCollection>{(item: unknown) => <span>{String(item)}</span>}</ComboboxCollection>
                </ComboboxGroup>
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
    ));
    tick();

    expect(screen.getByTestId("group")).toBeEmptyDOMElement();
  });
});
