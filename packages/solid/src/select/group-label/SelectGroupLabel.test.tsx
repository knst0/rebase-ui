import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { SelectGroup } from "../group/SelectGroup";
import { Root } from "../index.parts";
import { SelectItem } from "../item/SelectItem";
import { SelectItemText } from "../item-text/SelectItemText";
import { SelectList } from "../list/SelectList";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { SelectGroupLabel } from "./SelectGroupLabel";

describe("<Select.GroupLabel />", () => {
  it("associates the label with its parent group", () => {
    render(() => (
      <Root defaultOpen>
        <SelectPositioner alignItemWithTrigger={false}>
          <SelectList>
            <SelectGroup>
              <SelectGroupLabel>Fruits</SelectGroupLabel>
              <SelectItem value="a">
                <SelectItemText>a</SelectItemText>
              </SelectItem>
            </SelectGroup>
          </SelectList>
        </SelectPositioner>
      </Root>
    ));
    flush();

    const group = screen.getByRole("group");
    const label = screen.getByText("Fruits");

    expect(label.id).not.toBe("");
    expect(group).toHaveAttribute("aria-labelledby", label.id);
  });
});
