import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Popover from "../index.parts";

afterEach(cleanup);

describe("<Popover.Popup />", () => {
  it("labels the dialog popup by its title and description", async () => {
    mount(() => (
      <Popover.Root>
        <Popover.Trigger>Open popover</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Title>Heading</Popover.Title>
              <Popover.Description>Details</Popover.Description>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    tick();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open popover" }));
    tick();
    await nextFrames();

    const popup = screen.getByRole("dialog");
    const heading = screen.getByText("Heading");
    const details = screen.getByText("Details");
    expect(popup.getAttribute("aria-labelledby")).toBe(heading.getAttribute("id"));
    expect(popup.getAttribute("aria-describedby")).toBe(details.getAttribute("id"));
  });

  it.each([false, true])("does not start an entry phase when initially open (controlled=%s)", async (controlled) => {
    const openProps = controlled ? { open: true as const } : { defaultOpen: true };
    mount(() => (
      <Popover.Root {...openProps}>
        <Popover.Trigger>Toggle</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="popup">Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
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

  it("renders a backdrop beneath a modal popover", async () => {
    mount(() => (
      <Popover.Root modal>
        <Popover.Trigger>Open popover</Popover.Trigger>
        <Popover.Backdrop data-testid="backdrop" />
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    tick();

    expect(screen.getByTestId("backdrop")).toHaveAttribute("hidden");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open popover" }));
    tick();
    await nextFrames();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).not.toHaveAttribute("hidden");
    expect(backdrop).toHaveAttribute("data-open");
    expect(backdrop.style.getPropertyValue("user-select")).toBe("none");
  });
});
