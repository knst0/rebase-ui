import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { Menubar } from ".";
import { Menu } from "../menu";

afterEach(cleanup);

function Sub(props: { label: string; item: string }) {
  return (
    <Menu.Root>
      <Menu.Trigger>{props.label}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Item>{props.item}</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function Example(props: { disabled?: boolean }) {
  return (
    <Menubar data-testid="bar" disabled={props.disabled}>
      <Sub label="File" item="New" />
      <Sub label="Edit" item="Copy" />
    </Menubar>
  );
}

describe("<Menubar />", () => {
  it("renders the roles, orientation and roving tabindex", async () => {
    mount(() => <Example />);
    await tick();
    expect(screen.getByRole("menubar").getAttribute("aria-orientation")).toBe("horizontal");
    const [file, edit] = screen.getAllByRole("menuitem");
    expect(file!.getAttribute("tabindex")).toBe("0");
    expect(edit!.getAttribute("tabindex")).toBe("-1");
  });

  it("moves between triggers with arrow keys when closed", async () => {
    mount(() => <Example />);
    await tick();
    const [file, edit] = screen.getAllByRole("menuitem");
    file!.focus();
    await fire(file!, "keydown", { key: "ArrowRight" } as KeyboardEventInit);
    await tick();
    expect(document.activeElement).toBe(edit);
  });

  it("opens on mousedown, keeps open through the click, and closes on the next click", async () => {
    mount(() => <Example />);
    await tick();
    const file = screen.getByRole("menuitem", { name: "File" });
    await fire(file, "mousedown");
    await vi.waitFor(() => expect(file.getAttribute("aria-expanded")).toBe("true"));
    await fire(file, "click");
    await tick();
    expect(file.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menubar").hasAttribute("data-has-submenu-open")).toBe(true);

    await fire(file, "click");
    await vi.waitFor(() => expect(file.getAttribute("aria-expanded")).toBe("false"));
    expect(screen.getByRole("menubar").hasAttribute("data-has-submenu-open")).toBe(false);
  });

  it("switches to the sibling menu on focus while one is open", async () => {
    mount(() => <Example />);
    await tick();
    const file = screen.getByRole("menuitem", { name: "File" });
    const edit = screen.getByRole("menuitem", { name: "Edit" });
    await fire(file, "mousedown");
    await vi.waitFor(() => expect(file.getAttribute("aria-expanded")).toBe("true"));
    await fire(file, "click");
    await tick();

    edit.focus();
    await tick();
    await vi.waitFor(() => expect(edit.getAttribute("aria-expanded")).toBe("true"));
    expect(file.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("menubar").hasAttribute("data-has-submenu-open")).toBe(true);
  });

  it("disables all triggers", async () => {
    mount(() => <Example disabled />);
    await tick();
    const file = screen.getByText("File");
    await fire(file, "mousedown");
    await tick();
    expect(file.getAttribute("aria-expanded")).toBe("false");
  });
});
