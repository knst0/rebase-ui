import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Menu from "../index.parts";

afterEach(cleanup);

describe("<Menu.Trigger />", () => {
  it.each([true, false])("moves focus to the preceding element on Shift+Tab from the open trigger (modal=%s)", async (modal) => {
    const user = userEvent.setup();
    mount(() => (
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
    tick();

    const trigger = screen.getByRole("button", { name: "Toggle" });
    await user.click(trigger);
    tick();
    await nextFrames();
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // Menu normally closes on Shift+Tab from its content. Focus the trigger while it stays open.
    trigger.focus();
    tick();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.tab({ shift: true });
    tick();
    await nextFrames();

    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
    expect(screen.queryByRole("menu")).toBe(null);

    // Return focus must not steal the tab destination back after the close settles.
    await nextFrames();
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });
});
