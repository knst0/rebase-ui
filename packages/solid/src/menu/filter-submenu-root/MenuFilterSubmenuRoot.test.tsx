import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { nextFrames } from "#test-utils";

import * as Menu from "../index.parts";

describe("<Menu.FilterProvider /> submenus", () => {
  it("filters a submenu wrapped in its own provider", async () => {
    render(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Apple</Menu.Item>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>More fruits</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter more fruits" />
                            <Menu.List>
                              <Menu.Item>Banana</Menu.Item>
                              <Menu.Item>Cherry</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    flush();
    await nextFrames();

    // Filtering the parent hides the submenu trigger along with non-matching items.
    await user.type(screen.getByRole("searchbox", { name: "Filter actions" }), "apple");
    flush();
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);

    await user.clear(screen.getByRole("searchbox", { name: "Filter actions" }));
    flush();
    await user.click(screen.getByRole("menuitem", { name: "More fruits" }));
    flush();
    await nextFrames();

    const submenuInput = screen.getByRole("searchbox", { name: "Filter more fruits" });
    expect(submenuInput).toBeInTheDocument();

    await user.click(submenuInput);
    await user.type(submenuInput, "cher");
    flush();

    const submenu = submenuInput.closest('[role="dialog"]');
    expect(submenu).toHaveTextContent("Cherry");
    expect(submenu).not.toHaveTextContent("Banana");
  });

  it("keeps a plain submenu plain inside a filterable menu", async () => {
    render(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.Item>Nested</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    flush();
    await nextFrames();

    await user.click(screen.getByRole("menuitem", { name: "More" }));
    flush();
    await nextFrames();

    // The plain submenu keeps the menu role instead of becoming a dialog.
    expect(screen.getByRole("menuitem", { name: "Nested" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Nested" }).closest('[role="menu"]')).not.toBeNull();
  });

  it("opens with the cross-axis key and focuses the submenu input", async () => {
    render(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Apple</Menu.Item>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>More fruits</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter more fruits" />
                            <Menu.List>
                              <Menu.Item>Banana</Menu.Item>
                              <Menu.Item>Cherry</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    flush();
    await nextFrames();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    flush();
    await user.keyboard("{ArrowDown}");
    flush();
    expect(screen.getByRole("menuitem", { name: "More fruits" })).toHaveAttribute("data-highlighted", "");

    await user.keyboard("{ArrowRight}");
    flush();
    await nextFrames();

    const submenuInput = screen.getByRole("searchbox", { name: "Filter more fruits" });
    expect(submenuInput).toHaveFocus();

    // A keyboard open highlights the first item, as in an ordinary menu.
    expect(screen.getByRole("menuitem", { name: "Banana" })).toHaveAttribute("data-highlighted", "");
    expect(submenuInput).toHaveAttribute("aria-activedescendant", screen.getByRole("menuitem", { name: "Banana" }).id);

    await user.keyboard("{ArrowDown}");
    flush();
    expect(submenuInput).toHaveFocus();
    expect(screen.getByRole("menuitem", { name: "Cherry" })).toHaveAttribute("data-highlighted", "");
    expect(submenuInput).toHaveAttribute("aria-activedescendant", screen.getByRole("menuitem", { name: "Cherry" }).id);
  });

  it("closes with the cross-axis close key and returns focus to the parent input", async () => {
    render(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Apple</Menu.Item>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>More fruits</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter more fruits" />
                            <Menu.List>
                              <Menu.Item>Banana</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    flush();
    await nextFrames();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    flush();

    await user.keyboard("{ArrowRight}");
    flush();
    await nextFrames();
    expect(screen.getByRole("searchbox", { name: "Filter more fruits" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    flush();
    await nextFrames();

    expect(screen.queryByRole("searchbox", { name: "Filter more fruits" })).toBeNull();
    expect(input).toHaveFocus();
    expect(screen.getByRole("menuitem", { name: "More fruits" })).toHaveAttribute("data-highlighted", "");
  });

  it("returns virtual focus to the parent input on Escape and resumes filtering", async () => {
    render(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Apple</Menu.Item>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>More fruits</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter more fruits" />
                            <Menu.List>
                              <Menu.Item>Banana</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    flush();
    await nextFrames();

    const input = screen.getByRole("searchbox", { name: "Filter actions" });
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    flush();
    await user.keyboard("{ArrowRight}");
    flush();
    await nextFrames();

    await user.keyboard("{Escape}");
    flush();
    await nextFrames();

    expect(screen.queryByRole("searchbox", { name: "Filter more fruits" })).toBeNull();
    expect(input).toHaveFocus();

    // Filtering resumes in the parent menu.
    await user.type(input, "apple");
    flush();
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    expect(screen.getByRole("menuitem", { name: "Apple" })).toBeInTheDocument();
  });

  it("moves along the parent list with the main-axis keys from the submenu trigger", async () => {
    render(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Apple</Menu.Item>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>More fruits</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter more fruits" />
                            <Menu.List>
                              <Menu.Item>Banana</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                  <Menu.Item>Cherry</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    flush();
    await nextFrames();

    // Assistive technology can place real focus on the trigger; its main-axis keys move the
    // parent highlight from it.
    const trigger = screen.getByRole("menuitem", { name: "More fruits" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    flush();

    expect(screen.getByRole("menuitem", { name: "Cherry" })).toHaveAttribute("data-highlighted", "");

    fireEvent.keyDown(screen.getByRole("menuitem", { name: "More fruits" }), { key: "ArrowUp" });
    flush();

    expect(screen.getByRole("menuitem", { name: "Apple" })).toHaveAttribute("data-highlighted", "");
  });

  it("does not steal focus back to the parent input when the pointer moves over the submenu", async () => {
    render(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Apple</Menu.Item>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>More fruits</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter more fruits" />
                            <Menu.List>
                              <Menu.Item>Banana</Menu.Item>
                              <Menu.Item>Cherry</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    flush();
    await nextFrames();

    await user.click(screen.getByRole("menuitem", { name: "More fruits" }));
    flush();
    await nextFrames();

    const submenuInput = screen.getByRole("searchbox", { name: "Filter more fruits" }) as HTMLInputElement;
    await user.click(submenuInput);
    expect(document.activeElement).toBe(submenuInput);

    // The submenu popup is portalled, so its pointer events bubble through the parent popup's
    // handlers; the parent must recognize the pointer is not over its own popup and leave
    // focus (and the open submenu) alone.
    fireEvent.mouseMove(submenuInput);
    flush();

    expect(document.activeElement).toBe(submenuInput);
    expect(submenuInput.isConnected).toBe(true);
    expect(screen.getByRole("searchbox", { name: "Filter more fruits" })).toBeInTheDocument();
  });
});
