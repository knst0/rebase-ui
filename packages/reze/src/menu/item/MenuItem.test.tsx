import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import type { JSX } from "reze-js";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";

import * as Menu from "../index.parts";

afterEach(cleanup);

async function renderOpenMenu(children: () => JSX.Element) {
  mount(() => (
    <Menu.Root>
      <Menu.Trigger>Open menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>{children()}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  ));

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open menu" }));
  tick();
  await nextFrames();
  return user;
}

describe("<Menu.Item />", () => {
  it("renders the menuitem role and highlighted state while navigating", async () => {
    const user = await renderOpenMenu(() => (
      <>
        <Menu.Item>Profile</Menu.Item>
        <Menu.Item>Settings</Menu.Item>
      </>
    ));

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(2);

    await user.keyboard("{ArrowDown}");
    tick();
    expect(items[0]).toHaveAttribute("data-highlighted", "");
    expect(items[1]).not.toHaveAttribute("data-highlighted");

    await user.keyboard("{ArrowDown}");
    tick();
    expect(items[1]).toHaveAttribute("data-highlighted", "");
  });

  it("does not call the click handler when disabled", async () => {
    const onClick = vi.fn();
    const user = await renderOpenMenu(() => <Menu.Item disabled onClick={onClick} />);

    await user.click(screen.getByRole("menuitem"));
    tick();

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("menuitem")).toHaveAttribute("data-disabled", "");
  });
});

describe("<Menu.LinkItem />", () => {
  it("renders a link that does not close the menu by default", async () => {
    const user = await renderOpenMenu(() => <Menu.LinkItem href="https://example.com">Docs</Menu.LinkItem>);

    const link = screen.getByRole("menuitem");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://example.com");
    // A real navigation would unload the browser-mode test iframe.
    link.addEventListener("click", (event) => event.preventDefault());

    await user.click(link);
    tick();
    await nextFrames();

    expect(screen.queryByRole("menu")).toBeInTheDocument();
  });
});

describe("<Menu.CheckboxItem />", () => {
  it("toggles the checked state and renders the indicator", async () => {
    const onCheckedChange = vi.fn();
    const user = await renderOpenMenu(() => (
      <Menu.CheckboxItem onCheckedChange={onCheckedChange}>
        <Menu.CheckboxItemIndicator data-testid="indicator" />
        Show bookmarks
      </Menu.CheckboxItem>
    ));

    const item = screen.getByRole("menuitemcheckbox");
    expect(item).toHaveAttribute("aria-checked", "false");
    expect(item).toHaveAttribute("data-unchecked", "");
    expect(screen.queryByTestId("indicator")).toBeNull();

    await user.click(item);
    tick();
    await nextFrames();

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0][0]).toBe(true);
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(item).toHaveAttribute("data-checked", "");
    expect(screen.getByTestId("indicator")).toBeInTheDocument();
  });

  it("respects the controlled checked state", async () => {
    await renderOpenMenu(() => <Menu.CheckboxItem checked={false}>Show bookmarks</Menu.CheckboxItem>);

    expect(screen.getByRole("menuitemcheckbox")).toHaveAttribute("aria-checked", "false");
  });
});

describe("<Menu.RadioGroup /> and <Menu.RadioItem />", () => {
  it("selects the clicked radio item and reports the value", async () => {
    const onValueChange = vi.fn();
    const user = await renderOpenMenu(() => (
      <Menu.RadioGroup onValueChange={onValueChange}>
        <Menu.RadioItem value="light">
          <Menu.RadioItemIndicator data-testid="light-indicator" />
          Light
        </Menu.RadioItem>
        <Menu.RadioItem value="dark">
          <Menu.RadioItemIndicator data-testid="dark-indicator" />
          Dark
        </Menu.RadioItem>
      </Menu.RadioGroup>
    ));

    const items = screen.getAllByRole("menuitemradio");
    expect(items).toHaveLength(2);

    await user.click(items[1]);
    tick();
    await nextFrames();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe("dark");
    expect(items[1]).toHaveAttribute("aria-checked", "true");
    expect(items[1]).toHaveAttribute("data-checked", "");
    expect(screen.getByTestId("dark-indicator")).toBeInTheDocument();
    expect(screen.queryByTestId("light-indicator")).toBeNull();
  });
});

describe("<Menu.Group /> and <Menu.GroupLabel />", () => {
  it("associates the label with the group", async () => {
    await renderOpenMenu(() => (
      <Menu.Group>
        <Menu.GroupLabel>Account</Menu.GroupLabel>
        <Menu.Item>Profile</Menu.Item>
      </Menu.Group>
    ));

    const label = screen.getByText("Account");
    const group = label.parentElement;
    expect(group).toHaveAttribute("role", "group");
    expect(group?.getAttribute("aria-labelledby")).toBe(label.getAttribute("id"));
  });
});
