import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import type { ValidComponent } from "@solidjs/web";
import userEvent from "@testing-library/user-event";
import { flush, omit } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import { Button as ButtonPrimitive } from "../../button";
import * as Menu from "../index.parts";
import { createMenuHandle } from "../store/MenuHandle";

// A custom `as` wrapper like apps build: pulls its own props out with `omit` in the
// body, computes `class` in JSX, and forwards the rest. Feeds the inner Button a
// RenderElement dynamic proxy, which used to warn STRICT_READ_UNTRACKED on every read.
function TriggerButton<T extends ValidComponent = "button">(props: ButtonPrimitive.Props<T> & { variant?: string; iconOnly?: boolean }) {
  const rest = omit(props, "variant", "iconOnly", "class");

  return <ButtonPrimitive class={`nk-button-${props.variant ?? "soft"} ${props.class ?? ""}`} {...rest} />;
}

function renderMenu(rootProps: Menu.Root.Props = {}, itemProps: Menu.Item.Props = {}) {
  render(() => (
    <Menu.Root {...rootProps}>
      <Menu.Trigger>Open menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner data-testid="positioner">
          <Menu.Popup data-testid="popup">
            <Menu.Item {...itemProps}>Profile</Menu.Item>
            <Menu.Item>Settings</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  ));

  return {
    trigger: screen.getByRole("button", { name: "Open menu" }),
    popup: () => screen.queryByTestId("popup"),
    items: () => screen.queryAllByRole("menuitem"),
  };
}

async function openViaTrigger(trigger: HTMLElement) {
  const user = userEvent.setup();
  await user.click(trigger);
  flush();
  await nextFrames();
  return user;
}

describe("<Menu.Root />", () => {
  it("opens on trigger click and toggles closed on a second click", async () => {
    const { trigger, popup } = renderMenu();
    expect(popup()).toBeNull();

    await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(trigger);
    flush();
    await nextFrames();
    expect(popup()).toBeNull();
  });

  it("reports open changes with the trigger-press reason", async () => {
    const onOpenChange = vi.fn();
    const { trigger } = renderMenu({ onOpenChange });

    await openViaTrigger(trigger);

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(true);
    expect(onOpenChange.mock.calls[0][1].reason).toBe("trigger-press");
  });

  it("closes on Escape with the escape-key reason", async () => {
    const onOpenChange = vi.fn();
    const { trigger, popup } = renderMenu({ onOpenChange });

    const user = await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    await user.keyboard("{Escape}");
    flush();
    await nextFrames();

    expect(popup()).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "escape-key" }));
  });

  it("renders the menu role and associates the popup with the trigger", async () => {
    const { trigger, popup } = renderMenu();

    await openViaTrigger(trigger);

    const popupElement = popup();
    expect(popupElement).toHaveAttribute("role", "menu");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger.getAttribute("aria-controls")).toBe(popupElement?.getAttribute("id"));
  });

  it("closes when an item is clicked and reports the item-press reason", async () => {
    const onOpenChange = vi.fn();
    const onClick = vi.fn();
    const { trigger, popup, items } = renderMenu({ onOpenChange }, { onClick });

    const user = await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    await user.click(items()[0]);
    flush();
    await nextFrames();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "item-press" }));
  });

  it("keeps the menu open when an item with closeOnClick={false} is clicked", async () => {
    const { trigger, popup, items } = renderMenu({}, { closeOnClick: false });

    const user = await openViaTrigger(trigger);
    await user.click(items()[0]);
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
  });

  it("highlights items with arrow-key navigation", async () => {
    const { trigger, popup } = renderMenu();

    const user = await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    flush();

    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveAttribute("data-highlighted", "");
  });

  it("does not open when disabled", async () => {
    const { trigger, popup } = renderMenu({ disabled: true });

    await openViaTrigger(trigger);
    expect(popup()).toBeNull();
  });

  it("supports controlled open state", async () => {
    const { popup } = renderMenu({ open: true });
    flush();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
  });

  it("opens on detached trigger click", async () => {
    const handle = createMenuHandle();

    render(() => (
      <>
        <Menu.Trigger handle={handle} id="detached-trigger">
          Detached
        </Menu.Trigger>
        <Menu.Root handle={handle}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="popup">
                <Menu.Item>Profile</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </>
    ));

    expect(screen.queryByTestId("popup")).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Detached" }));
    flush();
    await nextFrames();

    expect(screen.queryByTestId("popup")).toBeInTheDocument();
  });

  it("opens and closes through a detached handle", async () => {
    const handle = createMenuHandle();

    render(() => (
      <>
        <Menu.Trigger handle={handle} id="detached-trigger">
          Detached
        </Menu.Trigger>
        <Menu.Root handle={handle}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="popup">
                <Menu.Item>Profile</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </>
    ));

    expect(screen.queryByTestId("popup")).toBeNull();

    handle.open("detached-trigger");
    flush();
    await nextFrames();
    expect(screen.queryByTestId("popup")).toBeInTheDocument();
    expect(handle.isOpen).toBe(true);

    handle.close();
    flush();
    await nextFrames();
    expect(screen.queryByTestId("popup")).toBeNull();
  });

  it("reads no reactive values outside a tracking scope with detached triggers", async () => {
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
      const handle = createMenuHandle();

      render(() => (
        <>
          <Menu.Trigger handle={handle} id="detached-trigger">
            Detached
          </Menu.Trigger>
          <Menu.Root handle={handle}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup">
                  <Menu.Item>Profile</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </>
      ));

      expect(screen.queryByTestId("popup")).toBeNull();

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Detached" }));
      flush();
      await nextFrames();

      expect(screen.queryByTestId("popup")).toBeInTheDocument();

      await user.click(screen.getByRole("menuitem"));
      flush();
      await nextFrames();

      expect(screen.queryByTestId("popup")).toBeNull();
      expect(diagnostics).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
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
      const { trigger, popup } = renderMenu();

      const user = await openViaTrigger(trigger);
      expect(popup()).toBeInTheDocument();

      await user.keyboard("{ArrowDown}");
      flush();

      await user.click(screen.getAllByRole("menuitem")[0]);
      flush();
      await nextFrames();

      expect(popup()).toBeNull();
      expect(diagnostics).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("reads no reactive values outside a tracking scope when the trigger renders as a wrapped Button", async () => {
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
      render(() => (
        <Menu.Root>
          <Menu.Trigger openOnHover as={TriggerButton} variant="ghost" iconOnly aria-label="Open menu">
            Open menu
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="positioner">
              <Menu.Popup data-testid="popup">
                <Menu.Item>Profile</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const trigger = screen.getByRole("button", { name: "Open menu" });
      const user = await openViaTrigger(trigger);
      expect(screen.queryByTestId("popup")).toBeInTheDocument();

      await user.click(trigger);
      flush();
      await nextFrames();

      expect(screen.queryByTestId("popup")).toBeNull();
      expect(diagnostics).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
