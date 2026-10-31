import { cleanup, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { NavigationMenu } from "..";

function Menu(props: { value?: string | null; onValueChange?: (value: any, details: any) => void; defaultValue?: string }) {
  return (
    <NavigationMenu.Root value={props.value} defaultValue={props.defaultValue} onValueChange={props.onValueChange} delay={0} closeDelay={0}>
      <NavigationMenu.List data-testid="list">
        <NavigationMenu.Item value="a">
          <NavigationMenu.Trigger data-testid="trigger-a">
            A<NavigationMenu.Icon data-testid="icon-a" />
          </NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="content-a">
            <NavigationMenu.Link href="#a" closeOnClick data-testid="link-a">
              Link A
            </NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="b">
          <NavigationMenu.Trigger data-testid="trigger-b">B</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="content-b">Content B</NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#c" active data-testid="link-c">
            C
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup data-testid="popup">
            <NavigationMenu.Viewport data-testid="viewport" />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

afterEach(cleanup);

describe("<NavigationMenu.Root />", () => {
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");

  afterEach(() => {
    warn.mockClear();
    error.mockClear();
  });

  function expectNoUntrackedReads() {
    const messages = [...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]));
    expect(messages.filter((message) => message.includes("STRICT_READ_UNTRACKED"))).toEqual([]);
  }

  it("renders nav > ul > li with composite link and marks active link", () => {
    render(() => <Menu />);
    expect(screen.getByTestId("list").tagName).toBe("UL");
    expect(screen.getByTestId("list").parentElement?.tagName).toBe("NAV");
    expect(screen.getByTestId("link-c")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByTestId("popup")).toBeNull();
    expect(screen.getByTestId("trigger-a")).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on click, moves content into the viewport and closes on Escape", async () => {
    const onValueChange = vi.fn();
    render(() => <Menu onValueChange={onValueChange} />);

    screen.getByTestId("trigger-a").click();

    await vi.waitFor(() => expect(screen.getByTestId("content-a")).toBeInTheDocument());
    expect(screen.getByTestId("viewport").contains(screen.getByTestId("content-a"))).toBe(true);
    expect(onValueChange.mock.calls[0][0]).toBe("a");
    await vi.waitFor(() => expect(screen.getByTestId("trigger-a")).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByTestId("trigger-a")).toHaveAttribute("data-popup-open");
    expect(screen.getByTestId("icon-a")).toHaveAttribute("data-popup-open");
    expect(screen.getByTestId("trigger-a").getAttribute("aria-controls")).toBe(screen.getByTestId("popup").id);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    await vi.waitFor(() => expect(screen.queryByTestId("popup")).toBeNull());
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBeNull();
    expect(onValueChange.mock.calls.at(-1)?.[1].reason).toBe("escape-key");
    expectNoUntrackedReads();
  });

  it("switches content when another trigger is clicked while open", async () => {
    render(() => <Menu defaultValue="a" />);

    await vi.waitFor(() => expect(screen.getByTestId("content-a")).toBeInTheDocument());

    screen.getByTestId("trigger-b").click();

    await vi.waitFor(() => expect(screen.getByTestId("content-b")).toBeInTheDocument());
    await vi.waitFor(() => expect(screen.queryByTestId("content-a")).toBeNull());
    expect(screen.getByTestId("trigger-a")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("trigger-b")).toHaveAttribute("aria-expanded", "true");
    expectNoUntrackedReads();
  });

  it("toggles closed on a second patient click and closes on link press", async () => {
    const onValueChange = vi.fn();
    render(() => <Menu onValueChange={onValueChange} />);

    screen.getByTestId("trigger-a").click();
    await vi.waitFor(() => expect(screen.getByTestId("link-a")).toBeInTheDocument());

    screen.getByTestId("link-a").click();
    await vi.waitFor(() => expect(screen.queryByTestId("popup")).toBeNull());
    expect(onValueChange.mock.calls.at(-1)?.[1].reason).toBe("link-press");

    screen.getByTestId("trigger-a").click();
    await vi.waitFor(() => expect(screen.getByTestId("popup")).toBeInTheDocument());
    await vi.waitFor(() => expect(screen.getByTestId("trigger-a")).toHaveAttribute("aria-expanded", "true"));
    screen.getByTestId("trigger-a").click();
    await vi.waitFor(() => expect(screen.queryByTestId("popup")).toBeNull());
    expectNoUntrackedReads();
  });

  it("opens with ArrowDown and closes on an outside press", async () => {
    render(() => <Menu />);

    const trigger = screen.getByTestId("trigger-a");
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await vi.waitFor(() => expect(screen.getByTestId("popup")).toBeInTheDocument());
    await vi.waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));

    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    await vi.waitFor(() => expect(screen.queryByTestId("popup")).toBeNull());
    expectNoUntrackedReads();
  });

  it("honors a controlled value and respects cancellation", async () => {
    const [value, setValue] = createSignal<string | null>(null);
    render(() => (
      <Menu
        value={value()}
        onValueChange={(next, details) => {
          if (next === "b") {
            details.cancel();
            return;
          }
          setValue(next);
        }}
      />
    ));

    screen.getByTestId("trigger-b").click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByTestId("popup")).toBeNull();

    screen.getByTestId("trigger-a").click();
    await vi.waitFor(() => expect(screen.getByTestId("content-a")).toBeInTheDocument());

    setValue(null);
    await vi.waitFor(() => expect(screen.queryByTestId("popup")).toBeNull());
    expectNoUntrackedReads();
  });

  it("opens on hover and switches between triggers without clicking", async () => {
    render(() => <Menu />);

    const hover = (element: HTMLElement) => {
      element.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
      element.dispatchEvent(new MouseEvent("mouseenter"));
      element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    };

    hover(screen.getByTestId("trigger-a"));
    await vi.waitFor(() => expect(screen.getByTestId("content-a")).toBeInTheDocument());

    hover(screen.getByTestId("trigger-b"));
    await vi.waitFor(() => expect(screen.getByTestId("content-b")).toBeInTheDocument());
    await vi.waitFor(() => expect(screen.getByTestId("trigger-b")).toHaveAttribute("aria-expanded", "true"));
    expectNoUntrackedReads();
  });

  it("keeps closed content in the document, hidden, with keepMounted", async () => {
    render(() => (
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item value="a">
            <NavigationMenu.Trigger data-testid="trigger">A</NavigationMenu.Trigger>
            <NavigationMenu.Content keepMounted data-testid="content">
              Kept
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport data-testid="viewport" />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ));

    expect(document.body.textContent).toContain("Kept");
    expect(screen.getByTestId("content")).toHaveAttribute("hidden");

    screen.getByTestId("trigger").click();
    await vi.waitFor(() => expect(screen.getByTestId("viewport").contains(screen.getByTestId("content"))).toBe(true));
    await vi.waitFor(() => expect(screen.getByTestId("content")).not.toHaveAttribute("hidden"));
    expectNoUntrackedReads();
  });

  it("renders nested roots as div with an inline viewport and closes the parent on link press", async () => {
    const onValueChange = vi.fn();
    render(() => (
      <NavigationMenu.Root defaultValue="outer" onValueChange={onValueChange} data-testid="outer-root">
        <NavigationMenu.List>
          <NavigationMenu.Item value="outer">
            <NavigationMenu.Trigger>Outer</NavigationMenu.Trigger>
            <NavigationMenu.Content data-testid="outer-content">
              <NavigationMenu.Root defaultValue="inner" data-testid="inner-root">
                <NavigationMenu.List>
                  <NavigationMenu.Item value="inner">
                    <NavigationMenu.Trigger data-testid="inner-trigger">Inner</NavigationMenu.Trigger>
                    <NavigationMenu.Content>
                      <NavigationMenu.Link href="#x" closeOnClick data-testid="inner-link">
                        X
                      </NavigationMenu.Link>
                    </NavigationMenu.Content>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
                <NavigationMenu.Viewport data-testid="inner-viewport" />
              </NavigationMenu.Root>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ));

    await vi.waitFor(() => expect(screen.getByTestId("inner-link")).toBeInTheDocument());
    expect(screen.getByTestId("outer-root").tagName).toBe("NAV");
    expect(screen.getByTestId("inner-root").tagName).toBe("DIV");
    expect(screen.getByTestId("inner-viewport").contains(screen.getByTestId("inner-link"))).toBe(true);

    screen.getByTestId("inner-link").click();
    await vi.waitFor(() => expect(onValueChange.mock.calls.at(-1)?.[0]).toBeNull());
    expect(onValueChange.mock.calls.at(-1)?.[1].reason).toBe("link-press");
    expectNoUntrackedReads();
  });
});
