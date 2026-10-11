import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { fireEvent, screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";

import * as Menu from "../index.parts";
import type { MenuRoot } from "../root/MenuRoot";

afterEach(cleanup);

function FilterMenu(props: { orientation?: MenuRoot.Orientation; extraAction?: boolean }) {
  return (
    <Menu.FilterProvider>
      <Menu.Root defaultOpen orientation={props.orientation}>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Input aria-label="Filter actions" />
              {props.extraAction ? <button type="button">Extra action</button> : null}
              <Menu.List>
                <Menu.Group>
                  <Menu.GroupLabel>Edit</Menu.GroupLabel>
                  <Menu.Item>Rename</Menu.Item>
                </Menu.Group>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  );
}

describe("<Menu.Popup /> filter input focus", () => {
  it("returns focus to the input when the list takes it from the input", async () => {
    mount(() => <FilterMenu />);
    tick();
    await nextFrames();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    input.focus();
    expect(input).toHaveFocus();

    // A press on a group or its label focuses the list, the nearest focusable ancestor.
    fireEvent.focus(screen.getByRole("menu"), { relatedTarget: input });
    tick();

    expect(input).toHaveFocus();
  });

  it("leaves focus on the list when the input did not have it", async () => {
    mount(() => <FilterMenu />);
    tick();
    await nextFrames();

    const list = screen.getByRole("menu");
    // A touch open leaves the input unfocused so the on-screen keyboard stays closed.
    (screen.getByRole("searchbox", { name: "Filter actions" }) as HTMLElement).blur();
    list.focus();
    tick();

    expect(list).toHaveFocus();
  });

  it.each([
    ["vertical", "ltr", "ArrowLeft"],
    ["vertical", "rtl", "ArrowRight"],
    ["horizontal", "ltr", "ArrowUp"],
    ["horizontal", "rtl", "ArrowUp"],
  ] as const)("returns focus with the %s %s close key", async (orientation, direction, key) => {
    document.dir = direction;
    try {
      mount(() => <FilterMenu orientation={orientation} extraAction />);
      tick();
      await nextFrames();

      const action = screen.getByRole("button", { name: "Extra action" });
      action.focus();
      expect(action).toHaveFocus();

      fireEvent.keyDown(action, { key });
      tick();

      expect(screen.getByRole("searchbox", { name: "Filter actions" })).toHaveFocus();
    } finally {
      document.dir = "";
    }
  });

  it("preserves input focus on item presses", async () => {
    mount(() => <FilterMenu />);
    tick();
    await nextFrames();

    const item = screen.getByRole("menuitem", { name: "Rename" });
    const itemMouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    item.dispatchEvent(itemMouseDown);

    expect(itemMouseDown.defaultPrevented).toBe(true);
  });
});
