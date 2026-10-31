import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
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
  it("opens on contextmenu and positions fixed", async () => {
    mount(() => <Example />);
    await tick();
    const trigger = screen.getByTestId("trigger");
    expect(screen.queryByRole("menu")).toBeNull();
    await fire(trigger, "contextmenu", { clientX: 40, clientY: 50 } as MouseEventInit);
    expect(await screen.findByRole("menu")).toBeTruthy();
    expect(trigger.getAttribute("data-popup-open")).toBe("");
    expect(screen.getByTestId("positioner").style.position).toBe("fixed");
  });

  it("does not open when disabled", async () => {
    mount(() => <Example disabled />);
    await tick();
    await fire(screen.getByTestId("trigger"), "contextmenu", { clientX: 1, clientY: 1 } as MouseEventInit);
    await tick();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes through an item click and fires its handler", async () => {
    const onClick = vi.fn();
    mount(() => <Example onClick={onClick} />);
    await tick();
    await fire(screen.getByTestId("trigger"), "contextmenu", { clientX: 10, clientY: 10 } as MouseEventInit);
    await fire(await screen.findByRole("menuitem", { name: "Copy" }), "click");
    await tick();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("trigger").hasAttribute("data-popup-open")).toBe(false);
  });

  it("ignores the mouseup of the opening gesture at the same point", async () => {
    const onClick = vi.fn();
    mount(() => <Example onClick={onClick} />);
    await tick();
    await fire(screen.getByTestId("trigger"), "contextmenu", { clientX: 10, clientY: 10 } as MouseEventInit);
    const item = await screen.findByRole("menuitem", { name: "Copy" });
    await fire(item, "mouseup", { button: 2, clientX: 10, clientY: 10 } as MouseEventInit);
    await tick();
    expect(onClick).not.toHaveBeenCalled();
  });
});
