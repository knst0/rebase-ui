import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import { createDrawerHandle } from "../handle";
import * as Drawer from "../index.parts";

function renderDrawer(rootProps: Drawer.Root.Props = {}) {
  render(() => (
    <Drawer.Root {...rootProps}>
      <Drawer.Trigger>Open drawer</Drawer.Trigger>
      <button type="button">Outside</button>
      <Drawer.Portal>
        <Drawer.Backdrop data-testid="backdrop" />
        <Drawer.Viewport data-testid="viewport">
          <Drawer.Popup data-testid="popup">
            <Drawer.Title>Drawer title</Drawer.Title>
            <Drawer.Description>Drawer description</Drawer.Description>
            <Drawer.Content data-testid="content">Body</Drawer.Content>
            <Drawer.Close>Close drawer</Drawer.Close>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  ));

  return {
    trigger: screen.getByRole("button", { name: "Open drawer" }),
    outside: screen.getByRole("button", { name: "Outside" }),
    popup: () => screen.queryByTestId("popup"),
    backdrop: () => screen.queryByTestId("backdrop"),
    viewport: () => screen.queryByTestId("viewport"),
    content: () => screen.queryByTestId("content"),
  };
}

async function openViaTrigger(trigger: HTMLElement) {
  const user = userEvent.setup();
  await user.click(trigger);
  flush();
  await nextFrames();
  return user;
}

describe("<Drawer.Root />", () => {
  it("opens when the trigger is clicked and closes when the close button is clicked", async () => {
    const { trigger, popup } = renderDrawer();

    expect(popup()).toBeNull();

    await openViaTrigger(trigger);

    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close drawer" }));
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
  });

  it("reads no reactive values outside a tracking scope while opening and closing", async () => {
    const diagnostics: string[] = [];
    const originalWarn = console.warn;
    const originalError = console.error;
    const recordDiagnostic = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("STRICT_READ_UNTRACKED")) {
        diagnostics.push(args[0]);
      }
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      recordDiagnostic(...args);
      originalWarn(...args);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      recordDiagnostic(...args);
      originalError(...args);
    });

    try {
      const { trigger, popup } = renderDrawer();

      await openViaTrigger(trigger);
      expect(popup()).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Close drawer" }));
      flush();
      await nextFrames();

      expect(popup()).toBeNull();
      expect(diagnostics).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("sets dialog semantics with title and description labelling", async () => {
    const { trigger, popup } = renderDrawer();

    await openViaTrigger(trigger);

    const popupElement = popup()!;
    expect(popupElement).toHaveAttribute("role", "dialog");
    expect(popupElement).toHaveAttribute("aria-modal", "true");

    const labelledBy = popupElement.getAttribute("aria-labelledby");
    const describedBy = popupElement.getAttribute("aria-describedby");
    expect(document.getElementById(labelledBy!)).toHaveTextContent("Drawer title");
    expect(document.getElementById(describedBy!)).toHaveTextContent("Drawer description");
  });

  it("exposes the swipe direction and swipe css vars on the popup", async () => {
    const { trigger, popup } = renderDrawer({ swipeDirection: "left" });

    await openViaTrigger(trigger);

    const popupElement = popup()!;
    expect(popupElement).toHaveAttribute("data-swipe-direction", "left");
    expect(popupElement.style.getPropertyValue("--drawer-swipe-movement-x")).toBe("0px");
    expect(popupElement.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("0px");
    expect(popupElement.style.getPropertyValue("--drawer-snap-point-offset")).toBe("0px");
    expect(popupElement.style.getPropertyValue("--drawer-swipe-strength")).toBe("1");
    expect(popupElement.style.getPropertyValue("--drawer-swipe-progress")).toBe("0");
  });

  it("marks the content element with the drawer content attribute", async () => {
    const { trigger, content } = renderDrawer();

    await openViaTrigger(trigger);

    expect(content()).toHaveAttribute("data-drawer-content", "");
  });

  it("opens inside Drawer.Indent without recreating the root subtree", async () => {
    render(() => (
      <Drawer.Indent data-testid="indent">
        <Drawer.Root>
          <Drawer.Trigger>Open drawer</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport data-testid="viewport">
              <Drawer.Popup data-testid="popup">
                <Drawer.Title>Drawer title</Drawer.Title>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Indent>
    ));

    const trigger = screen.getByRole("button", { name: "Open drawer" });
    expect(screen.queryByTestId("popup")).toBeNull();

    await openViaTrigger(trigger);

    // Opening must not re-resolve the indent children (which would recreate the
    // root with a fresh store): the popup mounts on the store the trigger wrote to.
    expect(screen.queryByTestId("popup")).toBeInTheDocument();
    expect(screen.queryByTestId("indent")).toHaveAttribute("data-inactive", "");
  });

  it("closes on Escape and reports the reason", async () => {
    const onOpenChange = vi.fn();
    const { trigger, popup } = renderDrawer({ onOpenChange });

    await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.keyboard("{Escape}");
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "escape-key" }));
  });

  it("supports controlled open state", async () => {
    const onOpenChange = vi.fn();
    const { trigger, popup } = renderDrawer({ open: true, onOpenChange });

    flush();
    await nextFrames();
    expect(popup()).toBeInTheDocument();

    // Clicking the trigger requests close but the controlled prop keeps it open.
    const user = userEvent.setup();
    await user.click(trigger);
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "trigger-press" }));
  });

  it("resets to the default snap point when closed", async () => {
    const onSnapPointChange = vi.fn();
    const { trigger, popup } = renderDrawer({ snapPoints: [0.5, 1], defaultSnapPoint: 0.5, onSnapPointChange });

    await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close drawer" }));
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
    expect(onSnapPointChange).toHaveBeenCalledWith(0.5, expect.anything());
  });

  it("opens via a detached trigger using a handle", async () => {
    const handle = createDrawerHandle();

    render(() => (
      <>
        <Drawer.Root handle={handle}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="handled-popup">
                <Drawer.Title>Handled</Drawer.Title>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
        <Drawer.Trigger handle={handle}>Detached open</Drawer.Trigger>
      </>
    ));

    expect(screen.queryByTestId("handled-popup")).toBeNull();

    await openViaTrigger(screen.getByRole("button", { name: "Detached open" }));

    expect(screen.queryByTestId("handled-popup")).toBeInTheDocument();
  });

  it("marks the parent popup when a nested drawer is open", async () => {
    render(() => (
      <Drawer.Root defaultOpen>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="outer-popup">
              <Drawer.Title>Outer</Drawer.Title>
              <Drawer.Root defaultOpen>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="inner-popup">
                      <Drawer.Title>Inner</Drawer.Title>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    flush();
    await nextFrames();

    expect(screen.queryByTestId("outer-popup")).toBeInTheDocument();
    expect(screen.queryByTestId("inner-popup")).toBeInTheDocument();
    expect(screen.queryByTestId("outer-popup")).toHaveAttribute("data-nested-drawer-open", "");
  });
});
