import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { For } from "reze-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import { createToastManager } from "../createToastManager";
import * as Toast from "../index.parts";
import type { UseToastManagerReturnValue } from "../useToastManager";
import * as ToastRootCssVars from "./ToastRootCssVars";

afterEach(cleanup);

function ToastList() {
  const manager = Toast.useToastManager();
  return (
    <For each={manager.toasts}>
      {(toast) => (
        <Toast.Root toast={toast}>
          <Toast.Content>
            <div>
              <Toast.Title />
              <Toast.Description />
            </div>
            <Toast.Close>Dismiss</Toast.Close>
          </Toast.Content>
        </Toast.Root>
      )}
    </For>
  );
}

function renderToastUI(providerProps?: Toast.Provider.Props) {
  let manager!: UseToastManagerReturnValue;

  function CaptureManager() {
    manager = Toast.useToastManager();
    return null;
  }

  mount(() => (
    <Toast.Provider {...providerProps}>
      <CaptureManager />
      <Toast.Portal>
        <Toast.Viewport data-testid="viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  ));
  tick();

  return {
    get manager() {
      return manager;
    },
    viewport: () => screen.queryByTestId("viewport"),
    toasts: () => screen.queryAllByRole("dialog", { hidden: true }),
  };
}

function addTestToast(manager: UseToastManagerReturnValue, options?: Record<string, unknown>) {
  const id = manager.add({ title: "Toast title", description: "Toast description", timeout: 0, ...options });
  tick();
  return id;
}

function mouseEnter(element: Element) {
  element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: true }));
}

describe("<Toast.Root />", () => {
  it("renders added toasts with title, description and positioning styles", async () => {
    const ui = renderToastUI();
    expect(ui.viewport()).toBeInTheDocument();
    expect(ui.toasts()).toHaveLength(0);

    addTestToast(ui.manager);
    await nextFrames();

    const toast = screen.getByRole("dialog", { hidden: true, name: "Toast title" });
    expect(toast).toBeInTheDocument();
    expect(screen.getByText("Toast title").tagName).toBe("H2");
    expect(screen.getByText("Toast description").tagName).toBe("P");

    // Positioning styles use kebab-case keys readable via getPropertyValue.
    expect(toast.style.getPropertyValue(ToastRootCssVars.index)).toBe("0");
    expect(toast.style.getPropertyValue(ToastRootCssVars.offsetY)).toBe("0px");
  });

  it("closes the toast when the close button is clicked", async () => {
    const ui = renderToastUI();
    addTestToast(ui.manager);
    await nextFrames();
    expect(screen.getByRole("dialog", { hidden: true, name: "Toast title" })).toBeInTheDocument();

    // The close button is aria-hidden until the viewport expands on hover.
    mouseEnter(ui.viewport()!);
    tick();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    tick();
    await nextFrames();

    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it("closes the focused toast on Escape", async () => {
    const ui = renderToastUI();
    addTestToast(ui.manager);
    await nextFrames();

    const toast = screen.getByRole("dialog", { hidden: true, name: "Toast title" });
    (toast as HTMLElement).focus();
    fire(toast, "keydown", { key: "Escape" } as KeyboardEventInit);
    tick();
    await nextFrames();

    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it("auto-dismisses toasts after the provider timeout", async () => {
    const ui = renderToastUI({ timeout: 80 });
    addTestToast(ui.manager, { timeout: undefined });
    tick();
    await nextFrames();
    expect(screen.getByRole("dialog", { hidden: true, name: "Toast title" })).toBeInTheDocument();

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 150);
    });
    tick();
    await nextFrames();

    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it("marks toasts beyond the limit as limited", async () => {
    const ui = renderToastUI({ limit: 1 });
    addTestToast(ui.manager, { title: "old" });
    addTestToast(ui.manager, { title: "new" });
    await nextFrames();

    expect(screen.getByText("old").closest('[role="dialog"]')).toHaveAttribute("data-limited");
    expect(screen.getByText("new").closest('[role="dialog"]')).not.toHaveAttribute("data-limited");
  });

  it("forwards toast updates from an external toast manager", async () => {
    const toastManager = createToastManager();
    const ui = renderToastUI({ toastManager });
    expect(ui.toasts()).toHaveLength(0);

    const id = toastManager.add({ title: "external", timeout: 0 });
    tick();
    await nextFrames();
    expect(screen.getByText("external")).toBeInTheDocument();

    toastManager.update(id, { title: "external updated" });
    tick();
    await nextFrames();
    expect(screen.getByText("external updated")).toBeInTheDocument();

    toastManager.close(id);
    tick();
    await nextFrames();
    expect(screen.queryByText("external updated")).toBeNull();
  });

  it("keeps each toast on its own DOM node when toasts are added", async () => {
    const ui = renderToastUI();
    ui.manager.add({ id: "first", title: "first", timeout: 0 });
    tick();
    await nextFrames();

    // The same toast must keep its DOM node so stack shifts animate via CSS
    // transitions instead of snapping.
    const firstNode = screen.getByRole("dialog", { hidden: true, name: "first" });
    expect(firstNode.style.getPropertyValue(ToastRootCssVars.index)).toBe("0");

    ui.manager.add({ id: "second", title: "second", timeout: 0 });
    tick();
    await nextFrames();

    expect(screen.getByRole("dialog", { hidden: true, name: "first" })).toBe(firstNode);
    expect(firstNode.style.getPropertyValue(ToastRootCssVars.index)).toBe("1");
    expect(screen.getByRole("dialog", { hidden: true, name: "second" })).toBeInTheDocument();
  });
});
