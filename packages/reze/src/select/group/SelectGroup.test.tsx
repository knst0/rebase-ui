import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { Root } from "../index.parts";
import { SelectItemText } from "../item-text/SelectItemText";
import { SelectItem } from "../item/SelectItem";
import { SelectList } from "../list/SelectList";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { SelectGroup } from "./SelectGroup";

afterEach(cleanup);

describe("<Select.Group />", () => {
  it("renders a group landmark for its items", () => {
    mount(() => (
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
    tick();

    const group = screen.getByTestId("group");
    expect(group).toHaveAttribute("role", "group");
    expect(screen.getByRole("option", { name: "a" })).toBeInTheDocument();
  });
});
