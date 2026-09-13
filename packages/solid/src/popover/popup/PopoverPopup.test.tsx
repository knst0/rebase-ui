import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Popover from "../index.parts";

describe("<Popover.Popup />", () => {
  it("labels the dialog popup by its title and description", async () => {
    render(() => (
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
    flush();

    fireEvent.click(screen.getByRole("button", { name: "Open popover" }));
    flush();
    await nextFrames();

    const popup = screen.getByRole("dialog");
    const heading = screen.getByText("Heading");
    const details = screen.getByText("Details");
    expect(popup.getAttribute("aria-labelledby")).toBe(heading.getAttribute("id"));
    expect(popup.getAttribute("aria-describedby")).toBe(details.getAttribute("id"));
  });

  it("renders a backdrop beneath a modal popover", async () => {
    render(() => (
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
    flush();

    expect(screen.getByTestId("backdrop")).toHaveAttribute("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Open popover" }));
    flush();
    await nextFrames();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).not.toHaveAttribute("hidden");
    expect(backdrop).toHaveAttribute("data-open");
    expect(backdrop.style.getPropertyValue("user-select")).toBe("none");
  });
});
