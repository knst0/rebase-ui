import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { nextFrames } from "#test-utils";

import * as Menu from "../index.parts";

async function renderMenuWithSubmenu() {
  render(() => (
    <Menu.Root>
      <Menu.Trigger>Open menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Item>Profile</Menu.Item>
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="submenu-positioner">
                  <Menu.Popup data-testid="submenu-popup">
                    <Menu.Item>Email link</Menu.Item>
                    <Menu.Item>Copy link</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  ));

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open menu" }));
  flush();
  await nextFrames();
  return user;
}

describe("<Menu.SubmenuRoot />", () => {
  it("opens the submenu on trigger hover and renders nested menu roles", async () => {
    const user = await renderMenuWithSubmenu();

    expect(screen.queryByTestId("submenu-popup")).toBeNull();

    await user.hover(screen.getByText("Share"));
    // The hover-open delay elapses in real time.
    await new Promise((resolve) => setTimeout(resolve, 250));
    flush();
    await nextFrames();

    const submenuPopup = screen.getByTestId("submenu-popup");
    expect(submenuPopup).toBeInTheDocument();
    expect(submenuPopup).toHaveAttribute("role", "menu");

    const positioner = screen.getByTestId("submenu-positioner");
    expect(positioner.style.getPropertyValue("position")).toBe("absolute");
  });

  it("keeps the submenu open while traversing from its trigger to its popup", async () => {
    const user = await renderMenuWithSubmenu();

    const submenuTrigger = screen.getByText("Share");
    await user.hover(submenuTrigger);
    await new Promise((resolve) => setTimeout(resolve, 250));
    flush();
    await nextFrames();

    expect(screen.getByTestId("submenu-popup")).toBeInTheDocument();

    // Give the trigger and positioner realistic layout: the safe polygon is pure geometry
    // over `getBoundingClientRect` rects (the floating element is the positioner wrapper),
    // and the test viewport leaves everything stacked at the origin with degenerate rects.
    const triggerRect = new DOMRect(0, 100, 120, 32);
    const popupRect = new DOMRect(128, 90, 200, 160);
    vi.spyOn(submenuTrigger, "getBoundingClientRect").mockReturnValue(triggerRect);
    vi.spyOn(screen.getByTestId("submenu-positioner"), "getBoundingClientRect").mockReturnValue(popupRect);

    // Leave the trigger toward the popup: installs the safe polygon with real coordinates.
    // (A bare `hover()` teleport carries no coordinates, which the polygon reads as (0, 0).)
    const startX = triggerRect.right;
    const startY = triggerRect.top + triggerRect.height / 2;
    submenuTrigger.dispatchEvent(
      new MouseEvent("mouseleave", {
        bubbles: false,
        cancelable: true,
        clientX: startX,
        clientY: startY,
        relatedTarget: document.body,
      }),
    );
    flush();

    // Traverse diagonally into the popup the way a real pointer moves: gap steps target
    // the body (polygon geometry decides), steps inside the popup target the item (landing).
    const endX = popupRect.left + 20;
    const endY = popupRect.top + 20;
    const item = screen.getByText("Email link");
    const steps = 8;
    for (let step = 0; step <= steps; step += 1) {
      const clientX = startX + ((endX - startX) * step) / steps;
      const clientY = startY + ((endY - startY) * step) / steps;
      const target = clientX < popupRect.left ? document.body : item;
      target.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX, clientY }),
      );
      flush();
    }
    await nextFrames();

    expect(screen.getByTestId("submenu-popup")).toBeInTheDocument();
    expect(screen.getAllByRole("menu")).toHaveLength(2);
  });

  it("closes only the submenu on Escape by default", async () => {
    const user = await renderMenuWithSubmenu();

    await user.hover(screen.getByText("Share"));
    await new Promise((resolve) => setTimeout(resolve, 250));
    flush();
    await nextFrames();
    expect(screen.getByTestId("submenu-popup")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    flush();
    await nextFrames();

    expect(screen.queryByTestId("submenu-popup")).toBeNull();
    // The parent menu stays open: Escape does not bubble past the submenu.
    expect(screen.getAllByRole("menu")).toHaveLength(1);
  });
});
