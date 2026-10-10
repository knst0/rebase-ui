import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Menu from "../index.parts";

describe("<Menu.Trigger />", () => {
  it.each([true, false])("moves focus to the preceding element on Shift+Tab from the open trigger (modal=%s)", async (modal) => {
    const user = userEvent.setup();
    render(() => (
      <div>
        <button>Before</button>
        <Menu.Root modal={modal}>
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    ));
    flush();

    const trigger = screen.getByRole("button", { name: "Toggle" });
    await user.click(trigger);
    flush();
    await nextFrames();
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // Menu normally closes on Shift+Tab from its content. Focus the trigger while it stays open.
    trigger.focus();
    flush();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.tab({ shift: true });
    flush();
    await nextFrames();

    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
    expect(screen.queryByRole("menu")).toBe(null);

    // Return focus must not steal the tab destination back after the close settles.
    await nextFrames();
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });
});
