import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Menu from "../index.parts";

describe("<Menu.Positioner />", () => {
  it("resumes positioning after a kept-mounted portal closes and reopens", async () => {
    render(() => {
      const [open, setOpen] = createSignal(false);
      return (
        <Menu.Root open={open()} onOpenChange={setOpen}>
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
    flush();
    await nextFrames();
    await nextFrames();

    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Open menu" });
    expect(screen.getByTestId("positioner")).toHaveAttribute("hidden");

    await user.click(trigger);
    flush();
    await nextFrames();
    await nextFrames();
    const positioner = screen.getByTestId("positioner");

    expect(positioner).toBeVisible();
    expect(positioner.style.position).toBe("absolute");
    expect(positioner.style.opacity).not.toBe("0");

    await user.click(trigger);
    flush();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toBe(positioner);
    expect(positioner).toHaveAttribute("hidden");
    expect(positioner).not.toBeVisible();

    await user.click(trigger);
    flush();
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
