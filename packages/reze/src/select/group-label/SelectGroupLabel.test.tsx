import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { SelectGroup } from "../group/SelectGroup";
import { Root } from "../index.parts";
import { SelectItemText } from "../item-text/SelectItemText";
import { SelectItem } from "../item/SelectItem";
import { SelectList } from "../list/SelectList";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { SelectGroupLabel } from "./SelectGroupLabel";

afterEach(cleanup);

describe("<Select.GroupLabel />", () => {
  it("associates the label with its parent group", () => {
    mount(() => (
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
    tick();

    const group = screen.getByRole("group");
    const label = screen.getByText("Fruits");

    expect(label.id).not.toBe("");
    expect(group).toHaveAttribute("aria-labelledby", label.id);
  });
});
