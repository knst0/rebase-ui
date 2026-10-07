import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Select from "../index.parts";
import { SelectPopup } from "../popup/SelectPopup";
import { SelectPortal } from "../portal/SelectPortal";
import { SelectPositioner } from "../positioner/SelectPositioner";
import { SelectArrow } from "./SelectArrow";

describe("<Select.Arrow />", () => {
  it("renders an accessible arrow reporting the popup side", async () => {
    render(() => (
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
    flush();
    await nextFrames();
    await nextFrames();

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
    expect(arrow).toHaveAttribute("data-open");
    expect(arrow.getAttribute("data-side")).toBe(screen.getByTestId("positioner").getAttribute("data-side"));
  });

  it("renders nothing while aligned with the trigger", async () => {
    render(() => (
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
    flush();
    await nextFrames();

    expect(screen.queryByTestId("arrow")).toBeNull();
  });
});
