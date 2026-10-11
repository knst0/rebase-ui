import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { fireEvent, screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { effect, omitProps, type JSX } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";

import { Button as ButtonPrimitive } from "../../button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import * as Menu from "../index.parts";
import { createMenuHandle } from "../store/MenuHandle";
import type { MenuStore } from "../store/MenuStore";
import type { MenuRoot } from "./MenuRoot";
import { useMenuRootContext } from "./MenuRootContext";

afterEach(cleanup);

function MenuStoreProbe(props: { onStore: (store: MenuStore<unknown>) => void }) {
  const { store } = useMenuRootContext();
  effect(() => {
    props.onStore(store as MenuStore<unknown>);
  });
  return null;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

// A custom `as` wrapper like apps build: pulls its own props out with `omit` in the
// body, computes `class` in JSX, and forwards the rest. Feeds the inner Button a
// RenderElement dynamic proxy, which used to warn STRICT_READ_UNTRACKED on every read.
function TriggerButton<T extends JSX.ElementType = "button">(props: ButtonPrimitive.Props<T> & { variant?: string; iconOnly?: boolean }) {
  const rest = omitProps(props, "variant", "iconOnly", "class");

  return <ButtonPrimitive class={`nk-button-${props.variant ?? "soft"} ${props.class ?? ""}`} {...rest} />;
}

function renderMenu(rootProps: Menu.Root.Props = {}, itemProps: Menu.Item.Props = {}) {
  mount(() => (
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
  tick();
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
    tick();
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
    tick();
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
    tick();
    await nextFrames();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "item-press" }));
  });

  it("keeps the menu open when an item with closeOnClick={false} is clicked", async () => {
    const { trigger, popup, items } = renderMenu({}, { closeOnClick: false });

    const user = await openViaTrigger(trigger);
    await user.click(items()[0]);
    tick();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
  });

  it("highlights items with arrow-key navigation", async () => {
    const { trigger, popup } = renderMenu();

    const user = await openViaTrigger(trigger);
    expect(popup()).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    tick();

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
    tick();
    await nextFrames();

    expect(popup()).toBeInTheDocument();
  });

  it("opens on detached trigger click", async () => {
    const handle = createMenuHandle();

    mount(() => (
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
    tick();
    await nextFrames();

    expect(screen.queryByTestId("popup")).toBeInTheDocument();
  });

  it("opens and closes through a detached handle", async () => {
    const handle = createMenuHandle();

    mount(() => (
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
    tick();
    await nextFrames();
    expect(screen.queryByTestId("popup")).toBeInTheDocument();
    expect(handle.isOpen).toBe(true);

    handle.close();
    tick();
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

      mount(() => (
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
      tick();
      await nextFrames();

      expect(screen.queryByTestId("popup")).toBeInTheDocument();

      await user.click(screen.getByRole("menuitem"));
      tick();
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
      tick();

      await user.click(screen.getAllByRole("menuitem")[0]);
      tick();
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
      mount(() => (
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
      tick();
      await nextFrames();

      expect(screen.queryByTestId("popup")).toBeNull();
      expect(diagnostics).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  describe("prop: onItemHighlighted", () => {
    function HighlightMenu(props: { onItemHighlighted: Menu.Root.Props["onItemHighlighted"] }) {
      return (
        <Menu.Root onItemHighlighted={props.onItemHighlighted}>
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>One</Menu.Item>
                <Menu.Item>Two</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger>Three</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>Nested</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    }

    async function openViaKeyboard(trigger: HTMLElement) {
      const user = userEvent.setup();
      trigger.focus();
      await user.keyboard("{Enter}");
      tick();
      await nextFrames();
      return user;
    }

    it("passes the keydown event for keyboard highlights", async () => {
      const onItemHighlighted = vi.fn();
      mount(() => <HighlightMenu onItemHighlighted={onItemHighlighted} />);

      const user = await openViaKeyboard(screen.getByRole("button", { name: "Toggle" }));
      expect(screen.getByRole("menuitem", { name: "One" })).toHaveAttribute("data-highlighted", "");

      await user.keyboard("{ArrowDown}");
      tick();
      await nextFrames();

      const second = screen.getByRole("menuitem", { name: "Two" });
      expect(second).toHaveAttribute("data-highlighted", "");

      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(onItemHighlighted).toHaveBeenLastCalledWith(second, expect.anything());
      expect(details.reason).toBe("keyboard");
      expect(details.event).toBeInstanceOf(KeyboardEvent);
      expect(details.event.key).toBe("ArrowDown");
      expect(details.label).toBe("Two");
    });

    it("passes the keydown event for typeahead highlights", async () => {
      const onItemHighlighted = vi.fn();
      mount(() => <HighlightMenu onItemHighlighted={onItemHighlighted} />);

      const user = await openViaKeyboard(screen.getByRole("button", { name: "Toggle" }));
      expect(screen.getByRole("menuitem", { name: "One" })).toHaveAttribute("data-highlighted", "");

      await user.keyboard("t");
      tick();
      await nextFrames();

      const second = screen.getByRole("menuitem", { name: "Two" });
      expect(second).toHaveAttribute("data-highlighted", "");

      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe("keyboard");
      expect(details.event).toBeInstanceOf(KeyboardEvent);
      expect(details.event.key).toBe("t");
    });

    it("passes native mouse and pointer events for pointer highlights", async () => {
      const onItemHighlighted = vi.fn();
      mount(() => <HighlightMenu onItemHighlighted={onItemHighlighted} />);

      fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
      tick();
      await nextFrames();

      const item = screen.getByRole("menuitem", { name: "Two" });
      // Nonzero movement: the happy-dom test env reports WebKit support, and list navigation
      // (like Safari) ignores movement-less mousemove events as spurious.
      const hoverEvent = new MouseEvent("mousemove", { bubbles: true, movementX: 1, movementY: 1 });
      fireEvent(item, hoverEvent);
      tick();
      await nextFrames();

      expect(onItemHighlighted).toHaveBeenLastCalledWith(item, expect.anything());
      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe("pointer");
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(details.event).toBe(hoverEvent);
      expect(details.event).not.toBeInstanceOf(PointerEvent);

      const leaveEvent = new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" });
      fireEvent(item, leaveEvent);
      tick();
      await nextFrames();

      expect(onItemHighlighted).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ reason: "pointer", event: leaveEvent }));
      expect(onItemHighlighted.mock.lastCall?.[1].event).toBe(leaveEvent);
    });

    it("passes the mouse event when a submenu trigger is hovered", async () => {
      const onItemHighlighted = vi.fn();
      mount(() => <HighlightMenu onItemHighlighted={onItemHighlighted} />);

      fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
      tick();
      await nextFrames();

      const submenuTrigger = screen.getByRole("menuitem", { name: "Three" });
      fireEvent.mouseEnter(submenuTrigger);
      tick();
      await nextFrames();

      expect(onItemHighlighted).toHaveBeenLastCalledWith(submenuTrigger, expect.anything());
      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe("pointer");
      expect(details.event).toBeInstanceOf(MouseEvent);
    });
  });

  // The 300ms touch-click cooldown guards against delayed click events on mobile: a tap
  // fires focus first (opening the menu) and the click only later. In production the
  // focus-open is produced by the menubar (unported), so these tests arm the cooldown by
  // driving the store directly with a trigger-focus open — the same `setOpen` path the
  // focus interaction takes. The menubar-level integration test
  // (upstream `Menubar.test.tsx`, "closes on a touch item click immediately after focus
  // opens another menu") has no port target until Menubar is ported.
  describe("touch-click close guard", () => {
    function renderCooldownMenu() {
      let menuStore: MenuStore<unknown> | undefined;
      mount(() => (
        <Menu.Root>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <MenuStoreProbe onStore={(store) => (menuStore = store)} />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="popup">
                <Menu.Item>Profile</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      tick();
      expect(menuStore).toBeDefined();
      return { store: menuStore! };
    }

    function focusOpen(store: MenuStore<unknown>) {
      store.setOpen(true, createChangeEventDetails(REASONS.triggerFocus, new FocusEvent("focus")));
      tick();
    }

    function touchClickClose(store: MenuStore<unknown>, reason: MenuRoot.ChangeEventReason) {
      store.setOpen(
        false,
        createChangeEventDetails(reason, new PointerEvent("click", { bubbles: true, cancelable: true, pointerType: "touch" })),
      );
      tick();
    }

    it("ignores a non-item touch click close within 300ms of a focus open, then honors it", async () => {
      const { store } = renderCooldownMenu();
      focusOpen(store);
      expect(screen.getByTestId("popup")).toBeInTheDocument();

      touchClickClose(store, REASONS.triggerPress);
      await nextFrames();
      expect(screen.getByTestId("popup")).toBeInTheDocument();
      expect(store.peek("open")).toBe(true);

      await sleep(350);
      touchClickClose(store, REASONS.triggerPress);
      await nextFrames();
      expect(screen.queryByTestId("popup")).toBe(null);
      expect(store.peek("open")).toBe(false);
    });

    it("closes on a touch item press while the cooldown is armed", async () => {
      const { store } = renderCooldownMenu();
      focusOpen(store);
      expect(screen.getByTestId("popup")).toBeInTheDocument();

      // Item presses bypass the guard (#5789): the menu must close even though the
      // 300ms cooldown started by the focus open is still active.
      touchClickClose(store, REASONS.itemPress);
      await nextFrames();
      expect(screen.queryByTestId("popup")).toBe(null);
      expect(store.peek("open")).toBe(false);
    });
  });
});
