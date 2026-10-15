import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Menu from "../index.parts";

afterEach(cleanup);

function FilterMenu(props: { autoHighlight?: boolean | "always"; onValueChange?: (value: string) => void }) {
  return (
    <Menu.FilterProvider
      autoHighlight={props.autoHighlight}
      onValueChange={props.onValueChange ? (value) => props.onValueChange?.(value) : undefined}
    >
      <Menu.Root>
        <Menu.Trigger>Open menu</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Input aria-label="Filter actions" />
              <Menu.List>
                <Menu.Item>Apple</Menu.Item>
                <Menu.Item>Banana</Menu.Item>
                <Menu.Item>Cherry</Menu.Item>
              </Menu.List>
              <Menu.Empty>No matches</Menu.Empty>
              <Menu.Clear>Clear</Menu.Clear>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  );
}

async function renderOpenMenu(props: { autoHighlight?: boolean | "always"; onValueChange?: (value: string) => void } = {}) {
  mount(() => <FilterMenu {...props} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open menu" }));
  tick();
  await nextFrames();
  return user;
}

describe("<Menu.FilterProvider />", () => {
  it("renders a dialog popup with a searchbox and a menu list", async () => {
    await renderOpenMenu();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Filter actions" })).toBeInTheDocument();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
    expect(screen.queryByText("No matches")).toBeNull();
    expect(screen.queryByText("Clear")).toBeNull();
  });

  it("filters items by query and shows the empty state when nothing matches", async () => {
    const onValueChange = vi.fn();
    const user = await renderOpenMenu({ onValueChange });

    await user.type(screen.getByRole("searchbox", { name: "Filter actions" }), "ap");
    tick();

    expect(onValueChange).toHaveBeenLastCalledWith("ap");
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    expect(screen.getByRole("menuitem", { name: "Apple" })).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Filter actions" }));
    await user.type(screen.getByRole("searchbox", { name: "Filter actions" }), "zzz");
    tick();

    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("clears the query from Menu.Clear and returns focus to the input", async () => {
    const user = await renderOpenMenu();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.type(input, "ap");
    tick();
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);

    await user.click(screen.getByText("Clear"));
    tick();

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });

  it("moves the highlight with arrow keys and activates with Enter", async () => {
    const user = await renderOpenMenu();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    tick();

    const apple = screen.getByRole("menuitem", { name: "Apple" });
    expect(apple).toHaveAttribute("data-highlighted", "");
    expect(input).toHaveAttribute("aria-activedescendant", apple.id);

    await user.keyboard("{Enter}");
    tick();
    await nextFrames();

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("keeps real focus on the input while arrow keys move the highlight", async () => {
    const user = await renderOpenMenu();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.click(input);

    await user.keyboard("{ArrowDown}");
    tick();
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-activedescendant", screen.getByRole("menuitem", { name: "Apple" }).id);

    await user.keyboard("{ArrowDown}");
    tick();
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-activedescendant", screen.getByRole("menuitem", { name: "Banana" }).id);

    // Typing still filters after navigating: focus never left the input.
    await user.keyboard("h");
    tick();
    expect(input).toHaveValue("h");
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  });

  it("does not move real focus to items on hover", async () => {
    const user = await renderOpenMenu();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.click(input);
    expect(input).toHaveFocus();

    await user.hover(screen.getByRole("menuitem", { name: "Banana" }));
    // Nonzero movement: the happy-dom test env reports WebKit support, and list navigation
    // (like Safari) ignores movement-less mousemove events as spurious.
    screen
      .getByRole("menuitem", { name: "Banana" })
      .dispatchEvent(new MouseEvent("mousemove", { bubbles: true, movementX: 1, movementY: 1 }));
    tick();

    expect(input).toHaveFocus();
    expect(screen.getByRole("menuitem", { name: "Banana" })).toHaveAttribute("data-highlighted", "");
    expect(input).toHaveAttribute("aria-activedescendant", screen.getByRole("menuitem", { name: "Banana" }).id);
  });

  it("highlights the first item on keyboard open and keeps the input in the arrow loop", async () => {
    mount(() => <FilterMenu />);
    const user = userEvent.setup();

    const trigger = screen.getByRole("button", { name: "Open menu" });
    trigger.focus();
    await user.keyboard("{Enter}");
    tick();
    await nextFrames();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    expect(input).toHaveFocus();
    const apple = screen.getByRole("menuitem", { name: "Apple" });
    expect(input).toHaveAttribute("aria-activedescendant", apple.id);

    // Past the last item the highlight escapes back to the input.
    await user.keyboard("{ArrowDown}{ArrowDown}");
    tick();
    expect(input).toHaveAttribute("aria-activedescendant", screen.getByRole("menuitem", { name: "Cherry" }).id);

    await user.keyboard("{ArrowDown}");
    tick();
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(input).toHaveAttribute("data-highlighted", "");
    expect(input).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    tick();
    expect(input).toHaveAttribute("aria-activedescendant", screen.getByRole("menuitem", { name: "Cherry" }).id);
  });

  it("closes with Escape and returns focus to the trigger", async () => {
    const user = await renderOpenMenu();
    const trigger = screen.getByRole("button", { name: "Open menu" });

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.click(input);
    await user.keyboard("{Escape}");
    tick();
    await nextFrames();

    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("closes with Shift+Tab and returns focus to the trigger", async () => {
    const user = await renderOpenMenu();
    const trigger = screen.getByRole("button", { name: "Open menu" });

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.click(input);
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    tick();
    await nextFrames();

    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("resets the query when the popup closes and keeps it when the reset is canceled", async () => {
    const user = userEvent.setup();
    const changes: Array<{ value: string; reason: string }> = [];
    let cancelNextReset = false;

    mount(() => (
      <Menu.FilterProvider
        onValueChange={(value, details) => {
          changes.push({ value, reason: details.reason });
          if (cancelNextReset && value === "") {
            details.cancel();
          }
        }}
      >
        <Menu.Root>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Apple</Menu.Item>
                  <Menu.Item>Banana</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    await user.click(screen.getByRole("button", { name: "Actions" }));
    tick();
    await nextFrames();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.click(input);
    await user.type(input, "a");
    tick();
    expect(input).toHaveValue("a");

    await user.keyboard("{Escape}");
    tick();
    await nextFrames();

    expect(changes.at(-1)).toEqual({ value: "", reason: "popup-close" });

    // Reopen with a query, then cancel the close reset: the query stays for the next open.
    await user.click(screen.getByRole("button", { name: "Actions" }));
    tick();
    await nextFrames();
    cancelNextReset = true;

    const reopened = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.click(reopened);
    await user.type(reopened, "b");
    tick();
    await user.keyboard("{Escape}");
    tick();
    await nextFrames();

    await user.click(screen.getByRole("button", { name: "Actions" }));
    tick();
    await nextFrames();
    expect(screen.getByRole("searchbox", { name: "Filter actions" })).toHaveValue("b");
  });

  it("auto-highlights the first match", async () => {
    const user = await renderOpenMenu({ autoHighlight: true });

    await user.type(screen.getByRole("searchbox", { name: "Filter actions" }), "an");
    tick();

    expect(screen.getByRole("menuitem", { name: "Banana" })).toHaveAttribute("data-highlighted", "");
  });

  it("emits no STRICT_READ_UNTRACKED warnings during filter interactions", async () => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = (...args: Array<unknown>) => {
      warnings.push(args.map(String).join(" "));
    };
    console.error = (...args: Array<unknown>) => {
      errors.push(args.map(String).join(" "));
    };

    try {
      const user = await renderOpenMenu({ autoHighlight: true });
      const input = screen.getByRole("searchbox", { name: "Filter actions" });
      await user.type(input, "a");
      tick();
      await user.keyboard("{ArrowDown}");
      tick();
      await user.click(screen.getByText("Clear"));
      tick();
      await user.keyboard("{Escape}");
      tick();
      await nextFrames();
    } finally {
      console.warn = originalWarn;
      console.error = originalError;
    }

    expect([...warnings, ...errors].filter((message) => message.includes("STRICT_READ_UNTRACKED"))).toEqual([]);
  });
});
