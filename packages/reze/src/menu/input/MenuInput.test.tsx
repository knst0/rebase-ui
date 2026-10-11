import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";

import * as Menu from "../index.parts";

afterEach(cleanup);

// This test asserts the non-WebKit behavior (`aria-selected` stays off), but the happy-dom
// test env reports WebKit support. Mock the engine flag off, mirroring how
// `MenuFilterRoot.webkit.test.tsx` mocks it on.
vi.mock("../../internals/utils/platform", async () => {
  const actual = await vi.importActual<typeof import("../../internals/utils/platform")>("../../internals/utils/platform");
  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, webkit: false },
    },
  };
});

describe("<Menu.Input />", () => {
  it("throws outside a filterable menu", () => {
    expect(() => mount(() => <Menu.Input aria-label="Filter actions" />)).toThrow(
      /must be placed in a menu wrapped in <Menu\.FilterProvider>/,
    );
  });

  it("exposes the highlight through aria-activedescendant and shows the focus ring", async () => {
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
    tick();
    await nextFrames();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    expect(input).toHaveAttribute("aria-controls", screen.getByRole("menu").id);

    await user.click(input);
    await user.keyboard("{ArrowDown}");
    tick();

    const apple = screen.getByRole("menuitem", { name: "Apple" });
    expect(input).toHaveAttribute("aria-activedescendant", apple.id);
    // The focus ring clears once keyboard navigation highlights an item.
    expect(input).not.toHaveAttribute("data-highlighted");
    // `aria-selected` stays off outside WebKit, where it would be invalid.
    expect(apple).not.toHaveAttribute("aria-selected");
  });
});
