import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Menu from "../index.parts";

// Upstream #5868: `aria-selected` is invalid on `menuitem`, but Safari VoiceOver needs it for
// arrow-key navigation. It renders only on WebKit, only on the highlighted item, and only while
// the filter input holds focus.
vi.mock("../../internals/utils/platform", async () => {
  const actual = await vi.importActual<typeof import("../../internals/utils/platform")>("../../internals/utils/platform");
  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, webkit: true },
    },
  };
});

describe("filterable menu WebKit selection state", () => {
  it("marks only the highlighted item while the input has focus", async () => {
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
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    flush();

    const apple = screen.getByRole("menuitem", { name: "Apple" });
    const banana = screen.getByRole("menuitem", { name: "Banana" });
    expect(apple).toHaveAttribute("aria-selected", "true");
    expect(banana).not.toHaveAttribute("aria-selected");

    // Moving focus out of the input clears the selection state.
    input.blur();
    flush();
    expect(apple).not.toHaveAttribute("aria-selected");

    input.focus();
    flush();
    expect(apple).toHaveAttribute("aria-selected", "true");
  });

  it("renders no selection state when nothing is highlighted", async () => {
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

    await user.click(screen.getByRole("searchbox", { name: "Filter actions" }));
    flush();

    expect(screen.getByRole("menuitem", { name: "Apple" })).not.toHaveAttribute("aria-selected");
    expect(screen.getByRole("menuitem", { name: "Banana" })).not.toHaveAttribute("aria-selected");
  });
});
