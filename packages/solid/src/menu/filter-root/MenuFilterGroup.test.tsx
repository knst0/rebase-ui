import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Menu from "../index.parts";

describe("filterable menu groups", () => {
  it("hides a group once the query filters out all of its items", async () => {
    render(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Group>
                    <Menu.GroupLabel>Fruits</Menu.GroupLabel>
                    <Menu.Item>Apple</Menu.Item>
                  </Menu.Group>
                  <Menu.Group>
                    <Menu.GroupLabel>Vegetables</Menu.GroupLabel>
                    <Menu.Item>Carrot</Menu.Item>
                  </Menu.Group>
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

    expect(screen.getByText("Fruits")).toBeInTheDocument();
    expect(screen.getByText("Vegetables")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Filter actions" }), "car");
    flush();

    // The emptied group (label included) hides while the matching group stays.
    expect(screen.getByText("Fruits").closest('[role="group"]')).toHaveAttribute("hidden");
    expect(screen.getByText("Vegetables").closest('[role="group"]')).not.toHaveAttribute("hidden");
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  });
});
