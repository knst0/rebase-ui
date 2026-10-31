import { render, screen, cleanup, fireEvent } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { ContextMenu } from "..";

afterEach(cleanup);

function Example(props: { onClick?: () => void; disabled?: boolean }) {
  return (
    <ContextMenu.Root disabled={props.disabled}>
      <ContextMenu.Trigger data-testid="trigger">area</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner data-testid="positioner">
          <ContextMenu.Popup>
            <ContextMenu.Item onClick={props.onClick}>Copy</ContextMenu.Item>
            <ContextMenu.Item>Paste</ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

describe("<ContextMenu.Root />", () => {
  it("opens on contextmenu and positions fixed at the cursor, without strict read warnings", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(() => <Example />);
    const trigger = screen.getByTestId("trigger");
    expect(screen.queryByRole("menu")).toBeNull();

    const defaultNotPrevented = fireEvent.contextMenu(trigger, { clientX: 40, clientY: 50 });
    flush();
    expect(defaultNotPrevented).toBe(false);
    expect(await screen.findByRole("menu")).toBeTruthy();
    expect(trigger.getAttribute("data-popup-open")).toBe("");
    expect(screen.getByTestId("positioner").style.position).toBe("fixed");

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    flush();

    const logged = [...warn.mock.calls, ...error.mock.calls].flat().join("\n");
    warn.mockRestore();
    error.mockRestore();
    expect(logged).not.toContain("STRICT_READ_UNTRACKED");
  });

  it("does not open when disabled", () => {
    render(() => <Example disabled />);
    fireEvent.contextMenu(screen.getByTestId("trigger"), { clientX: 1, clientY: 1 });
    flush();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes through an item click and fires its handler", async () => {
    const onClick = vi.fn();
    render(() => <Example onClick={onClick} />);
    fireEvent.contextMenu(screen.getByTestId("trigger"), { clientX: 10, clientY: 10 });
    flush();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Copy" }));
    flush();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("trigger").hasAttribute("data-popup-open")).toBe(false);
  });

  it("ignores the mouseup of the opening gesture at the same point", async () => {
    const onClick = vi.fn();
    render(() => <Example onClick={onClick} />);
    fireEvent.contextMenu(screen.getByTestId("trigger"), { clientX: 10, clientY: 10 });
    flush();
    const item = await screen.findByRole("menuitem", { name: "Copy" });
    fireEvent.mouseUp(item, { button: 2, clientX: 10, clientY: 10 });
    flush();
    expect(onClick).not.toHaveBeenCalled();
  });
});
