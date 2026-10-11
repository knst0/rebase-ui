import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Menu from "../index.parts";

describe("<Menu.CheckboxItem />", () => {
  it("toggles with Space after closing during typeahead and reopening", async () => {
    const user = userEvent.setup();
    render(() => (
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
    flush();

    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    await user.keyboard("[Enter]");
    flush();
    await nextFrames();
    expect(screen.getByRole("menuitemcheckbox")).toHaveFocus();

    // Typing starts a typeahead session, which swallows Space; closing must end
    // the session so Space toggles again after reopening (#5816).
    await user.keyboard("s[Escape]");
    flush();
    await nextFrames();
    expect(trigger).toHaveFocus();

    await user.keyboard("[Enter]");
    flush();
    await nextFrames();
    const item = screen.getByRole("menuitemcheckbox");
    expect(item).toHaveFocus();
    expect(item).toHaveAttribute("aria-checked", "false");

    await user.keyboard("[Space]");
    flush();
    await nextFrames();
    expect(item).toHaveAttribute("aria-checked", "true");
  });
});
