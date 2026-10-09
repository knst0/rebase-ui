import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Popover from "../index.parts";

describe("<Popover.Positioner />", () => {
  it("positions the popup with kebab-case styles and reports side", async () => {
    render(() => (
      <Popover.Root>
        <Popover.Trigger>Open popover</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner data-testid="positioner">
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    flush();

    fireEvent.click(screen.getByRole("button", { name: "Open popover" }));
    flush();
    await nextFrames();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner.style.getPropertyValue("position")).toBe("absolute");
    expect(positioner.style.getPropertyValue("top")).toMatch(/px$/);
    expect(positioner.style.getPropertyValue("left")).toMatch(/px$/);
    expect(positioner.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
    expect(positioner).toHaveAttribute("data-open");
  });

  it("stays hidden until mounted", async () => {
    render(() => (
      <Popover.Root>
        <Popover.Portal keepMounted>
          <Popover.Positioner data-testid="positioner">
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    flush();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toHaveAttribute("hidden");
  });

  it("repositions a retained popup after closing and reopening", async () => {
    const [open, setOpen] = createSignal(true);
    render(() => (
      <Popover.Root open={open()} onOpenChange={setOpen}>
        <Popover.Trigger>Open popover</Popover.Trigger>
        <Popover.Portal keepMounted>
          <Popover.Positioner data-testid="positioner">
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    flush();
    await nextFrames();
    await nextFrames();

    const positioner = screen.getByTestId("positioner");
    expect(positioner).toBeVisible();
    expect(positioner.style.opacity).not.toBe("0");

    setOpen(false);
    flush();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toBe(positioner);
    expect(positioner).toHaveAttribute("hidden");

    setOpen(true);
    flush();
    await nextFrames();
    await nextFrames();

    expect(screen.getByTestId("positioner")).toBe(positioner);
    expect(positioner).not.toHaveAttribute("hidden");
    expect(positioner).toHaveAttribute("data-open");
    expect(positioner).toBeVisible();
    expect(positioner.style.opacity).not.toBe("0");
    expect(positioner.style.getPropertyValue("position")).toBe("absolute");
    expect(positioner.style.getPropertyValue("top")).toMatch(/px$/);
    expect(positioner.style.getPropertyValue("left")).toMatch(/px$/);
  });

  it("renders an arrow with positioning styles", async () => {
    render(() => (
      <Popover.Root>
        <Popover.Trigger>Open popover</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Arrow data-testid="arrow" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    flush();

    fireEvent.click(screen.getByRole("button", { name: "Open popover" }));
    flush();
    await nextFrames();
    await nextFrames();

    const arrow = screen.getByTestId("arrow");
    expect(arrow).toHaveAttribute("aria-hidden", "true");
    expect(arrow.getAttribute("data-side")).toMatch(/^(top|bottom|left|right|inline-start|inline-end)$/);
  });
});
