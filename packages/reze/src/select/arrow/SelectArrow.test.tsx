import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Select from "../index.parts";
import { SelectPopup } from "../popup/SelectPopup";
import { SelectPortal } from "../portal/SelectPortal";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { SelectArrow } from "./SelectArrow";

afterEach(cleanup);

describe("<Select.Arrow />", () => {
  it("renders an accessible arrow reporting the popup side", async () => {
    mount(() => (
      <Select.Root defaultOpen>
        <SelectPortal>
          <SelectPositioner data-testid="positioner" alignItemWithTrigger={false}>
            <SelectPopup>
              Content
              <SelectArrow data-testid="arrow" />
            </SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select.Root>
    ));
    tick();
    await nextFrames();
    await nextFrames();

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
    expect(arrow).toHaveAttribute("data-open");
    expect(arrow.getAttribute("data-side")).toBe(screen.getByTestId("positioner").getAttribute("data-side"));
  });

  it("renders nothing while aligned with the trigger", async () => {
    mount(() => (
      <Select.Root defaultOpen>
        <SelectPortal>
          <SelectPositioner>
            <SelectPopup>
              Content
              <SelectArrow data-testid="arrow" />
            </SelectPopup>
          </SelectPositioner>
        </SelectPortal>
      </Select.Root>
    ));
    tick();
    await nextFrames();

    expect(screen.queryByTestId("arrow")).toBeNull();
  });
});
