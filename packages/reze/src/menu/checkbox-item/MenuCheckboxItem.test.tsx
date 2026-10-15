import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Menu from "../index.parts";

afterEach(cleanup);

describe("<Menu.CheckboxItem />", () => {
  it("toggles with Space after closing during typeahead and reopening", async () => {
    const user = userEvent.setup();
    mount(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.CheckboxItem>Settings</Menu.CheckboxItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    tick();

    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    await user.keyboard("[Enter]");
    tick();
    await nextFrames();
    expect(screen.getByRole("menuitemcheckbox")).toHaveFocus();

    // Typing starts a typeahead session, which swallows Space; closing must end
    // the session so Space toggles again after reopening (#5816).
    await user.keyboard("s[Escape]");
    tick();
    await nextFrames();
    expect(trigger).toHaveFocus();

    await user.keyboard("[Enter]");
    tick();
    await nextFrames();
    const item = screen.getByRole("menuitemcheckbox");
    expect(item).toHaveFocus();
    expect(item).toHaveAttribute("aria-checked", "false");

    await user.keyboard("[Space]");
    tick();
    await nextFrames();
    expect(item).toHaveAttribute("aria-checked", "true");
  });
});
