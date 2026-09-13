import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { Root } from "../index.parts";
import { SelectItem } from "../item/SelectItem";
import { SelectItemText } from "../item-text/SelectItemText";
import { SelectList } from "../list/SelectList";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { SelectGroup } from "./SelectGroup";

describe("<Select.Group />", () => {
  it("renders a group landmark for its items", () => {
    render(() => (
      <Root defaultOpen>
        <SelectPositioner alignItemWithTrigger={false}>
          <SelectList>
            <SelectGroup data-testid="group">
              <SelectItem value="a">
                <SelectItemText>a</SelectItemText>
              </SelectItem>
            </SelectGroup>
          </SelectList>
        </SelectPositioner>
      </Root>
    ));
    flush();

    const group = screen.getByTestId("group");
    expect(group).toHaveAttribute("role", "group");
    expect(screen.getByRole("option", { name: "a" })).toBeInTheDocument();
  });
});
