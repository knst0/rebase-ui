import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Tooltip from "../index.parts";

afterEach(cleanup);

describe("<Tooltip.Portal />", () => {
  it("renders the popup into the document body", async () => {
    mount(() => (
      <div data-testid="root-container">
        <Tooltip.Root open>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Portaled content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    ));
    tick();
    await nextFrames();

    const popup = screen.getByText("Portaled content");
    expect(popup).toBeInTheDocument();
    expect(screen.getByTestId("root-container").contains(popup)).toBe(false);
  });

  it("renders nothing when closed unless kept mounted", async () => {
    const { dispose } = mount(() => (
      <Tooltip.Root>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Hidden content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    tick();

    expect(screen.queryByText("Hidden content")).toBeNull();
    dispose();
  });
});
