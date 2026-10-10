import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Menu from "../index.parts";

describe("<Menu.Input />", () => {
  it("throws outside a filterable menu", () => {
    expect(() => render(() => <Menu.Input aria-label="Filter actions" />)).toThrow(
      /must be placed in a menu wrapped in <Menu\.FilterProvider>/,
    );
  });

  it("exposes the highlight through aria-activedescendant and shows the focus ring", async () => {
    render(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Apple</Menu.Item>
                  <Menu.Item>Banana</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    flush();
    await nextFrames();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    expect(input).toHaveAttribute("aria-controls", screen.getByRole("menu").id);

    await user.click(input);
    await user.keyboard("{ArrowDown}");
    flush();

    const apple = screen.getByRole("menuitem", { name: "Apple" });
    expect(input).toHaveAttribute("aria-activedescendant", apple.id);
    // The focus ring clears once keyboard navigation highlights an item.
    expect(input).not.toHaveAttribute("data-highlighted");
    // `aria-selected` stays off outside WebKit, where it would be invalid.
    expect(apple).not.toHaveAttribute("aria-selected");
  });
});
