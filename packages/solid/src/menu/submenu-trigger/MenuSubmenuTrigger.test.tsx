import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush, onSettled } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Menu from "../index.parts";
import { useMenuRootContext } from "../root/MenuRootContext";
import type { MenuStore } from "../store/MenuStore";

function SubmenuStoreProbe(props: { onStore: (store: MenuStore<unknown>) => void }) {
  const { store } = useMenuRootContext();
  onSettled(() => {
    props.onStore(store as MenuStore<unknown>);
  });
  return null;
}

describe("<Menu.SubmenuTrigger />", () => {
  it("keeps the submenu open on direct trigger focus but closes it on guard return", async () => {
    const user = userEvent.setup();
    const onSubmenuOpenChange = vi.fn();
    const onParentOpenChange = vi.fn();
    let submenuStore: MenuStore<unknown> | undefined;
    render(() => (
      <Menu.Root onOpenChange={onParentOpenChange}>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="parent-menu">
              <Menu.SubmenuRoot onOpenChange={onSubmenuOpenChange}>
                <Menu.SubmenuTrigger openOnHover={false}>More</Menu.SubmenuTrigger>
                <SubmenuStoreProbe onStore={(store) => (submenuStore = store)} />
                <Menu.Portal>
                  <Menu.Positioner data-testid="submenu-positioner">
                    <Menu.Popup data-testid="submenu">
                      <Menu.Item>Alpha</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
              <Menu.Item>Play Next</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    flush();

    await user.click(screen.getByRole("button", { name: "Actions" }));
    flush();
    await nextFrames();
    const trigger = screen.getByRole("menuitem", { name: "More" });
    await user.click(trigger);
    flush();
    await nextFrames();
    expect(screen.getByTestId("submenu")).toBeInTheDocument();
    expect(submenuStore).toBeDefined();

    // Direct focus on the trigger from a submenu item leaves it open.
    const item = screen.getByRole("menuitem", { name: "Alpha" });
    item.focus();
    trigger.focus();
    flush();
    await nextFrames();
    expect(screen.getByTestId("submenu")).toBeInTheDocument();

    // Focus returning through the submenu's content guard closes it with a focus-out reason.
    // Menu portals don't render floating focus-manager guards yet, so the guard side of
    // the wiring is driven directly: the positioner stands in for the guard element.
    item.focus();
    // Let the focus manager's queued microtasks drain while the submenu is still open,
    // matching production timing between user actions. Without this yield the parent's
    // focus-out check runs after the submenu already closed and sees the submenu item
    // as unrelated, closing the parent too.
    await Promise.resolve();
    const positioner = screen.getByTestId("submenu-positioner");
    submenuStore!.context.beforeContentFocusGuardRef.current = positioner;
    positioner.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: trigger }));
    trigger.focus();
    flush();
    await nextFrames();

    expect(screen.queryByTestId("submenu")).toBe(null);
    expect(screen.getByTestId("parent-menu")).toBeInTheDocument();
    expect(onParentOpenChange).not.toHaveBeenCalledWith(false, expect.anything());
    expect(onSubmenuOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "focus-out" }));

    await user.keyboard("[ArrowDown]");
    flush();
    await nextFrames();
    expect(screen.getByRole("menuitem", { name: "Play Next" })).toHaveFocus();
  });

  it("toggles the submenu on repeated activation with openOnHover={false}", async () => {
    const user = userEvent.setup();
    render(() => (
      <Menu.Root>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="parent-menu">
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger openOnHover={false}>More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu">
                      <Menu.Item>Alpha</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    flush();

    await user.click(screen.getByRole("button", { name: "Actions" }));
    flush();
    await nextFrames();
    const trigger = screen.getByRole("menuitem", { name: "More" });

    await user.click(trigger);
    flush();
    await nextFrames();
    expect(screen.getByTestId("submenu")).toBeInTheDocument();

    await user.click(trigger);
    flush();
    await nextFrames();
    expect(screen.queryByTestId("submenu")).toBe(null);
    expect(screen.getByTestId("parent-menu")).toBeInTheDocument();

    await user.click(trigger);
    flush();
    await nextFrames();
    expect(screen.getByTestId("submenu")).toBeInTheDocument();
    expect(screen.getByTestId("parent-menu")).toBeInTheDocument();
  });

  it("keeps a hover-opened submenu open on keyboard activation, then toggles on the next one", async () => {
    const user = userEvent.setup();
    render(() => (
      <Menu.Root>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="parent-menu">
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu">
                      <Menu.Item>Alpha</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    flush();

    await user.click(screen.getByRole("button", { name: "Actions" }));
    flush();
    await nextFrames();
    const trigger = screen.getByRole("menuitem", { name: "More" });

    await user.hover(trigger);
    await new Promise((resolve) => setTimeout(resolve, 250));
    flush();
    await nextFrames();
    expect(screen.getByTestId("submenu")).toBeInTheDocument();

    // The first activation after hover-opening keeps the submenu open (stick-if-open).
    trigger.focus();
    fireEvent.click(trigger);
    flush();
    await nextFrames();
    expect(screen.getByTestId("submenu")).toBeInTheDocument();

    // A repeated activation toggles it closed.
    fireEvent.click(trigger);
    flush();
    await nextFrames();
    expect(screen.queryByTestId("submenu")).toBe(null);
    expect(screen.getByTestId("parent-menu")).toBeInTheDocument();
  });
});
