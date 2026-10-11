import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Popover from "../index.parts";

afterEach(cleanup);

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function mouseEnter(element: Element) {
  element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: true }));
}

function mouseMove(element: Element) {
  element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true }));
}

function mouseLeave(element: Element, relatedTarget: Element | null = document.body) {
  element.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false, cancelable: true, relatedTarget }));
}

describe("<Popover.Trigger />", () => {
  it("exposes dialog semantics and owns the popup id while open", async () => {
    mount(() => (
      <Popover.Root>
        <Popover.Trigger>Open popover</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    tick();

    const trigger = screen.getByRole("button", { name: "Open popover" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");

    const user = userEvent.setup();
    await user.click(trigger);
    tick();
    await nextFrames();

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const controls = trigger.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(screen.getByText("Content").getAttribute("id")).toBe(controls);
  });

  it("mounts a closed hover trigger without opening and keeps its hover config", async () => {
    const onOpenChange = vi.fn();
    mount(() => (
      <Popover.Root onOpenChange={onOpenChange}>
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
    tick();
    await nextFrames();

    // Mounting performs no open work: the popup stays unmounted and closed.
    const trigger = screen.getByRole("button", { name: "Hover me" });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Content")).not.toBeInTheDocument();

    // The eagerly synced hover config still applies on first interaction.
    mouseEnter(trigger);
    await sleep(10);
    tick();
    await nextFrames();
    expect(screen.queryByText("Content")).toBeInTheDocument();
  });

  it("opens on hover when openOnHover is set", async () => {
    mount(() => (
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
    tick();

    mouseEnter(screen.getByRole("button", { name: "Hover me" }));
    await sleep(10);
    tick();
    await nextFrames();

    expect(screen.queryByText("Content")).toBeInTheDocument();
  });

  it("opens on hover with the default delay without requiring mouse movement", async () => {
    mount(() => (
      <Popover.Root>
        <Popover.Trigger openOnHover>Hover me</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    tick();

    // A plain hover (enter + wait, no mousemove) must open the popover once
    // the default open delay elapses.
    mouseEnter(screen.getByRole("button", { name: "Hover me" }));
    await sleep(400);
    tick();
    await nextFrames();

    expect(screen.queryByText("Content")).toBeInTheDocument();
  });

  it("does not scroll the page when a click-opened popover moves focus inside", async () => {
    // Only meaningful in a real browser (CI runs chromium): jsdom has no
    // layout, so focus never scrolls there and this passes vacuously.
    mount(() => (
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
    tick();
    await nextFrames();

    // A real mouse click: pointerdown carries the pointer type, so the open
    // is classified as a pointer (not keyboard) interaction.
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Profile" }));
    tick();
    await nextFrames();
    await sleep(300);
    tick();
    await nextFrames();

    // Focus still moves into the popup, but the page must not jump.
    expect(document.activeElement?.textContent).toContain("Profile settings");
    expect(window.scrollY).toBe(0);
  });

  it("honors closeDelay when leaving a hover-opened popup", async () => {
    mount(() => (
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
    tick();

    mouseEnter(screen.getByRole("button", { name: "Hover me" }));
    await sleep(10);
    tick();
    await nextFrames();
    const popup = screen.queryByText("Content")?.closest('[role="dialog"]') as HTMLElement | null;
    expect(popup).not.toBeNull();

    // The floating hover listener is attached to the positioner (the floating
    // element), and mouseleave does not bubble, so leave from there.
    const positioner = popup!.parentElement as HTMLElement;

    // Leaving the popup must not close it before closeDelay elapses.
    mouseLeave(positioner, document.body);
    await sleep(50);
    tick();
    await nextFrames();
    expect(screen.queryByText("Content")).toBeInTheDocument();

    await sleep(600);
    tick();
    await nextFrames();
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("opens on hover after the rest delay when a delay is set", async () => {
    mount(() => (
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
    tick();

    const trigger = screen.getByRole("button", { name: "Hover me" });
    mouseEnter(trigger);
    mouseMove(trigger);
    await sleep(100);
    tick();
    await nextFrames();

    expect(screen.queryByText("Content")).toBeInTheDocument();
  });

  it("moves focus to the element preceding the trigger when tabbing backward from the trigger while open", async () => {
    const user = userEvent.setup();
    mount(() => (
      <div>
        <button>Before</button>
        <Popover.Root>
          <Popover.Trigger>Toggle</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                <button>Inside</button>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    ));
    tick();

    const trigger = screen.getByRole("button", { name: "Toggle" });
    await user.click(trigger);
    tick();
    await nextFrames();
    expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();

    // Focus the trigger while the popover stays open.
    trigger.focus();
    tick();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Shift+Tab from the trigger closes the popover and continues to the preceding element.
    await user.tab({ shift: true });
    tick();
    await nextFrames();

    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBe(null);

    // Return focus must not steal the tab destination back after the close settles.
    await nextFrames();
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
  });
});
