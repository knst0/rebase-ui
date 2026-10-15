import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { fireEvent, screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Menu from "../index.parts";

afterEach(cleanup);

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("<Menu.Popup />", () => {
  it.each([false, true])("does not start an entry phase when initially open (controlled=%s)", async (controlled) => {
    const openProps = controlled ? { open: true as const } : { defaultOpen: true };
    mount(() => (
      <Menu.Root {...openProps}>
        <Menu.Trigger>Toggle</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="popup">
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    // The Root-owned store is seeded synchronously: even the first paint must not
    // report the starting phase for an initially open popup.
    expect(screen.getByTestId("popup")).not.toHaveAttribute("data-starting-style");

    tick();
    await nextFrames();

    const popup = screen.getByTestId("popup");
    expect(popup).not.toHaveAttribute("data-starting-style");
    expect(popup).not.toHaveAttribute("data-ending-style");
  });

  it("receives the interaction type of the item press that closed the menu", async () => {
    const finalFocus = vi.fn(() => true);
    const user = userEvent.setup();

    mount(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup finalFocus={finalFocus}>
              <Menu.Item>Close</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    tick();

    const trigger = screen.getByRole("button", { name: "Open" });

    await user.click(trigger);
    tick();
    await nextFrames();
    const item = screen.getByRole("menuitem", { name: "Close" });
    fireEvent.pointerDown(item, { pointerType: "mouse" });
    fireEvent.click(item, { detail: 1 });
    tick();
    await nextFrames();
    expect(trigger).toHaveFocus();
    expect(finalFocus).toHaveBeenLastCalledWith("mouse");

    await user.keyboard("{Enter}");
    tick();
    await nextFrames();
    expect(screen.getByRole("menuitem", { name: "Close" })).toBeInTheDocument();
    await user.keyboard("{Enter}");
    tick();
    await nextFrames();
    expect(trigger).toHaveFocus();
    expect(finalFocus).toHaveBeenLastCalledWith("keyboard");
  });

  it("receives the mouse interaction type after a drag-release item selection", async () => {
    const finalFocus = vi.fn(() => true);

    mount(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup finalFocus={finalFocus}>
              <Menu.Item>Close</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    tick();

    const trigger = screen.getByRole("button", { name: "Open" });
    fireEvent.mouseDown(trigger);
    tick();
    await nextFrames();
    const item = screen.getByRole("menuitem", { name: "Close" });

    // Drag-release selection is only armed 200ms after the trigger press.
    await sleep(250);
    tick();
    fireEvent.mouseUp(item);
    tick();
    await nextFrames();

    expect(screen.queryByRole("menu")).toBe(null);
    expect(finalFocus).toHaveBeenLastCalledWith("mouse");
  });

  it("closes on a touch item click (item presses bypass the touch-click guard)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    mount(() => (
      <Menu.Root onOpenChange={onOpenChange}>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Close</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    tick();

    await user.click(screen.getByRole("button", { name: "Open" }));
    tick();
    await nextFrames();

    const item = screen.getByRole("menuitem", { name: "Close" });
    fireEvent(item, new PointerEvent("click", { bubbles: true, cancelable: true, pointerType: "touch" }));
    tick();
    await nextFrames();

    expect(screen.queryByRole("menu")).toBe(null);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "item-press" }));
  });
});
