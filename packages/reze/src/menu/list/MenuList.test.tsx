import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";

import * as Menu from "../index.parts";

afterEach(cleanup);

describe("<Menu.List />", () => {
  it("carries the menu role in a plain menu while the popup becomes presentational", async () => {
    mount(() => (
      <Menu.Root>
        <Menu.Trigger>Open menu</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <span>Header content</span>
              <Menu.List>
                <Menu.Item>Apple</Menu.Item>
                <Menu.Item>Banana</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    tick();
    await nextFrames();

    const list = screen.getByRole("menu");
    expect(list).toHaveAttribute("tabIndex", "-1");
    expect(list).toHaveAttribute("aria-labelledby", screen.getByRole("button", { name: "Open menu" }).id);
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);

    // The popup itself no longer claims menu semantics.
    const popup = list.parentElement;
    expect(popup).toHaveAttribute("role", "presentation");
    expect(popup).not.toHaveAttribute("aria-labelledby");

    // The trigger controls the list, not the popup.
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-controls", list.id);
  });

  it("takes the menu role in a filterable menu", async () => {
    mount(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Apple</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    tick();
    await nextFrames();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Apple" })).toBeInTheDocument();
  });
});
