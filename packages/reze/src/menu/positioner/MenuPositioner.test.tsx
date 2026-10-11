import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { store } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";

import * as Menu from "../index.parts";

afterEach(cleanup);

describe("<Menu.Positioner />", () => {
  it("resumes positioning after a kept-mounted portal closes and reopens", async () => {
    mount(() => {
      const state = store({ open: false });
      return (
        <Menu.Root
          open={state.open}
          onOpenChange={(nextOpen) => {
            state.open = nextOpen;
          }}
        >
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal keepMounted>
            <Menu.Positioner data-testid="positioner">
              <Menu.Popup>
                <Menu.Item>Profile</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    });
    tick();
    await nextFrames();
    await nextFrames();

    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Open menu" });
    expect(screen.getByTestId("positioner")).toHaveAttribute("hidden");

    await user.click(trigger);
    tick();
    await nextFrames();
    await nextFrames();
    const positioner = screen.getByTestId("positioner");

    expect(positioner).toBeVisible();
    expect(positioner.style.position).toBe("absolute");
    expect(positioner.style.opacity).not.toBe("0");

    await user.click(trigger);
    tick();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toBe(positioner);
    expect(positioner).toHaveAttribute("hidden");
    expect(positioner).not.toBeVisible();

    await user.click(trigger);
    tick();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toBe(positioner);
    expect(positioner).not.toHaveAttribute("hidden");
    expect(positioner).toBeVisible();
    expect(positioner.style.position).toBe("absolute");
    expect(positioner.style.opacity).not.toBe("0");
    expect(positioner.style.top).toMatch(/px$/);
    expect(positioner.style.left).toMatch(/px$/);
  });
});
