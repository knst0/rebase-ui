import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { nextFrames } from "#test-utils";

import * as Popover from "../index.parts";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("<Popover.Trigger />", () => {
  it("exposes dialog semantics and owns the popup id while open", async () => {
    render(() => (
      <Popover.Root>
        <Popover.Trigger>Open popover</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    flush();

    const trigger = screen.getByRole("button", { name: "Open popover" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");

    fireEvent.click(trigger);
    flush();
    await nextFrames();

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const controls = trigger.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(screen.getByText("Content").getAttribute("id")).toBe(controls);
  });

  it("mounts a closed hover trigger without opening and keeps its hover config", async () => {
    render(() => (
      <Popover.Root>
        <Popover.Trigger openOnHover delay={0} closeDelay={200}>
          Hover me
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    flush();
    await nextFrames();

    // Mounting performs no open work: the popup stays unmounted and closed.
    const trigger = screen.getByRole("button", { name: "Hover me" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Content")).not.toBeInTheDocument();

    // The eagerly synced hover config still applies on first interaction.
    fireEvent.mouseEnter(trigger);
    await sleep(10);
    flush();
    await nextFrames();
    expect(screen.queryByText("Content")).toBeInTheDocument();
  });

  it("opens on hover when openOnHover is set", async () => {
    render(() => (
      <Popover.Root>
        <Popover.Trigger openOnHover delay={0}>
          Hover me
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    flush();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Hover me" }));
    await sleep(10);
    flush();
    await nextFrames();

    expect(screen.queryByText("Content")).toBeInTheDocument();
  });

  it("opens on hover with the default delay without requiring mouse movement", async () => {
    render(() => (
      <Popover.Root>
        <Popover.Trigger openOnHover>Hover me</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    flush();

    // A plain hover (enter + wait, no mousemove) must open the popover once
    // the default open delay elapses.
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Hover me" }));
    await sleep(400);
    flush();
    await nextFrames();

    expect(screen.queryByText("Content")).toBeInTheDocument();
  });

  it("does not scroll the page when a click-opened popover moves focus inside", async () => {
    // Only meaningful in a real browser (CI runs chromium): jsdom has no
    // layout, so focus never scrolls there and this passes vacuously.
    render(() => (
      <div>
        {/* Push the trigger below the fold so the popup opens out of view. */}
        <div style={{ height: "2000px" }} />
        <Popover.Root>
          <Popover.Trigger>Profile</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={8}>
              <Popover.Popup>
                <div>
                  <a href="#">Profile settings</a>
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <div style={{ height: "2000px" }} />
      </div>
    ));
    flush();
    await nextFrames();

    // A real mouse click: pointerdown carries the pointer type, so the open
    // is classified as a pointer (not keyboard) interaction. A bare
    // fireEvent.click has detail 0 and reads as keyboard, which intentionally
    // keeps scroll-into-view.
    const trigger = screen.getByRole("button", { name: "Profile" });
    fireEvent.pointerDown(trigger, { pointerType: "mouse", detail: 1 });
    fireEvent.mouseDown(trigger, { detail: 1 });
    fireEvent.click(trigger, { detail: 1 });
    flush();
    await nextFrames();
    await sleep(300);
    flush();
    await nextFrames();

    // Focus still moves into the popup, but the page must not jump.
    expect(document.activeElement?.textContent).toContain("Profile settings");
    expect(window.scrollY).toBe(0);
  });

  it("honors closeDelay when leaving a hover-opened popup", async () => {
    render(() => (
      <Popover.Root>
        <Popover.Trigger openOnHover delay={0} closeDelay={200}>
          Hover me
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    flush();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Hover me" }));
    await sleep(10);
    flush();
    await nextFrames();
    const popup = screen.queryByText("Content")?.closest('[role="dialog"]') as HTMLElement | null;
    expect(popup).not.toBeNull();

    // The floating hover listener is attached to the positioner (the floating
    // element), and mouseleave does not bubble, so leave from there.
    const positioner = popup!.parentElement as HTMLElement;

    // Leaving the popup must not close it before closeDelay elapses.
    fireEvent.mouseLeave(positioner, { relatedTarget: document.body });
    await sleep(50);
    flush();
    await nextFrames();
    expect(screen.queryByText("Content")).toBeInTheDocument();

    await sleep(600);
    flush();
    await nextFrames();
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("opens on hover after the rest delay when a delay is set", async () => {
    render(() => (
      <Popover.Root>
        <Popover.Trigger openOnHover delay={50}>
          Hover me
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    flush();

    const trigger = screen.getByRole("button", { name: "Hover me" });
    fireEvent.mouseEnter(trigger);
    fireEvent.mouseMove(trigger);
    await sleep(100);
    flush();
    await nextFrames();

    expect(screen.queryByText("Content")).toBeInTheDocument();
  });
});
