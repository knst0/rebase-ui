import { render, screen, cleanup, fireEvent } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { Menubar } from ".";
import { Menu } from "../menu";

afterEach(cleanup);

function Sub(props: { label: string; item: string; disabled?: boolean }) {
  return (
    <Menu.Root disabled={props.disabled}>
      <Menu.Trigger>{props.label}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup data-testid={`popup-${props.label}`}>
            <Menu.Item>{props.item}</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function Example(props: { modal?: boolean; disabled?: boolean }) {
  return (
    <Menubar data-testid="bar" modal={props.modal} disabled={props.disabled}>
      <Sub label="File" item="New" />
      <Sub label="Edit" item="Copy" />
    </Menubar>
  );
}

const key = (el: Element, name: string) => {
  fireEvent.keyDown(el, { key: name });
  flush();
};

describe("<Menubar />", () => {
  it("renders the roles, orientation and roving tabindex", () => {
    render(() => <Example />);
    const bar = screen.getByRole("menubar");
    expect(bar.getAttribute("aria-orientation")).toBe("horizontal");
    const [file, edit] = screen.getAllByRole("menuitem");
    expect(file!.getAttribute("tabindex")).toBe("0");
    expect(edit!.getAttribute("tabindex")).toBe("-1");
  });

  it("moves between triggers with arrow keys when closed", () => {
    render(() => <Example />);
    const [file, edit] = screen.getAllByRole("menuitem");
    file!.focus();
    key(file!, "ArrowRight");
    expect(document.activeElement).toBe(edit);
  });

  it("opens on mousedown, keeps open through the click, and closes on the next click", async () => {
    render(() => <Example />);
    const file = screen.getByRole("menuitem", { name: "File" });
    fireEvent.mouseDown(file);
    await vi.waitFor(() => expect(file.getAttribute("aria-expanded")).toBe("true"));
    fireEvent.mouseUp(file);
    fireEvent.click(file);
    flush();
    expect(file.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menubar").hasAttribute("data-has-submenu-open")).toBe(true);

    fireEvent.click(file);
    flush();
    expect(file.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("menubar").hasAttribute("data-has-submenu-open")).toBe(false);
  });

  it("switches to the sibling menu on focus while one is open, without strict read warnings", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(() => <Example />);
    const file = screen.getByRole("menuitem", { name: "File" });
    const edit = screen.getByRole("menuitem", { name: "Edit" });
    fireEvent.mouseDown(file);
    await vi.waitFor(() => expect(file.getAttribute("aria-expanded")).toBe("true"));
    fireEvent.click(file);
    flush();
    expect(file.getAttribute("aria-expanded")).toBe("true");

    edit.focus();
    flush();
    await vi.waitFor(() => expect(edit.getAttribute("aria-expanded")).toBe("true"));
    expect(file.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("menubar").hasAttribute("data-has-submenu-open")).toBe(true);

    const logged = [...warn.mock.calls, ...error.mock.calls].flat().join("\n");
    warn.mockRestore();
    error.mockRestore();
    expect(logged).not.toContain("STRICT_READ_UNTRACKED");
  });

  it("navigates across menus with arrow keys from the popup", async () => {
    render(() => <Example />);
    const file = screen.getByRole("menuitem", { name: "File" });
    const edit = screen.getByRole("menuitem", { name: "Edit" });
    file.focus();
    key(file, "ArrowDown");
    await vi.waitFor(() => expect(file.getAttribute("aria-expanded")).toBe("true"));
    const item = await screen.findByRole("menuitem", { name: "New" });
    await vi.waitFor(() => expect(document.activeElement).toBe(item));

    key(item, "ArrowRight");
    await vi.waitFor(() => expect(edit.getAttribute("aria-expanded")).toBe("true"));
    expect(file.getAttribute("aria-expanded")).toBe("false");
  });

  it("disables all triggers", () => {
    render(() => <Example disabled />);
    const file = screen.getByText("File");
    fireEvent.mouseDown(file);
    flush();
    expect(file.getAttribute("aria-expanded")).toBe("false");
  });
});
