import "@testing-library/jest-dom/vitest";
import { fireEvent, screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createRenderer, describeConformance } from "#test-utils";

import { Toggle } from "../../toggle/Toggle";
import { ToolbarButton } from "../button/ToolbarButton";
import { ToolbarGroup } from "../group/ToolbarGroup";
import { ToolbarInput } from "../input/ToolbarInput";
import { ToolbarLink } from "../link/ToolbarLink";
import { ToolbarSeparator } from "../separator/ToolbarSeparator";
import { ToolbarRoot } from "./ToolbarRoot";

function press(element: Element, key: string) {
  fireEvent.keyDown(element, { key });
  flush();
}

describe("<Toolbar.Root />", () => {
  const { render } = createRenderer();

  describeConformance((props) => <ToolbarRoot {...props} />, {
    defaultElement: "div",
    as: { targetElement: "span" },
  });

  it("has the toolbar role and orientation attributes", async () => {
    await render(() => <ToolbarRoot />);
    const toolbar = screen.getByRole("toolbar");
    expect(toolbar).toHaveAttribute("aria-orientation", "horizontal");
    expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  });

  it("moves roving focus with arrows and wraps by default", async () => {
    await render(() => (
      <ToolbarRoot>
        <ToolbarButton data-testid="one" />
        <ToolbarLink href="#" data-testid="two" />
        <ToolbarButton data-testid="three" />
      </ToolbarRoot>
    ));
    flush();
    const [one, two, three] = ["one", "two", "three"].map((id) => screen.getByTestId(id));

    expect(one).toHaveAttribute("tabindex", "0");
    expect(two).toHaveAttribute("tabindex", "-1");

    one.focus();
    press(one, "ArrowRight");
    expect(two).toHaveFocus();
    press(two, "ArrowRight");
    expect(three).toHaveFocus();
    press(three, "ArrowRight");
    expect(one).toHaveFocus();
    press(one, "ArrowLeft");
    expect(three).toHaveFocus();
  });

  it("does not wrap when loopFocus is false", async () => {
    await render(() => (
      <ToolbarRoot loopFocus={false}>
        <ToolbarButton data-testid="one" />
        <ToolbarButton data-testid="two" />
      </ToolbarRoot>
    ));
    flush();
    const one = screen.getByTestId("one");
    one.focus();
    press(one, "ArrowLeft");
    expect(one).toHaveFocus();
  });

  it("navigates with vertical arrows when vertical", async () => {
    await render(() => (
      <ToolbarRoot orientation="vertical">
        <ToolbarButton data-testid="one" />
        <ToolbarButton data-testid="two" />
      </ToolbarRoot>
    ));
    flush();
    const one = screen.getByTestId("one");
    one.focus();
    press(one, "ArrowDown");
    expect(screen.getByTestId("two")).toHaveFocus();
    expect(one).toHaveAttribute("data-orientation", "vertical");
  });

  it("skips disabled items only when they are not focusable", async () => {
    const [disabled, setDisabled] = createSignal(false);
    await render(() => (
      <ToolbarRoot>
        <ToolbarButton data-testid="one" />
        <ToolbarButton data-testid="two" disabled={disabled()} focusableWhenDisabled={false} />
        <ToolbarButton data-testid="three" disabled />
      </ToolbarRoot>
    ));
    flush();
    const one = screen.getByTestId("one");
    one.focus();
    press(one, "ArrowRight");
    expect(screen.getByTestId("two")).toHaveFocus();

    press(screen.getByTestId("two"), "ArrowLeft");
    setDisabled(true);
    flush();
    press(one, "ArrowRight");
    const three = screen.getByTestId("three");
    expect(three).toHaveFocus();
    expect(three).toHaveAttribute("aria-disabled", "true");
    expect(three).not.toHaveAttribute("disabled");
    expect(three).toHaveAttribute("data-focusable");
  });

  it("propagates disabled from the root and the group", async () => {
    const onClick = vi.fn();
    const [rootDisabled, setRootDisabled] = createSignal(false);
    await render(() => (
      <ToolbarRoot disabled={rootDisabled()}>
        <ToolbarGroup disabled data-testid="group">
          <ToolbarButton data-testid="in-group" onClick={onClick} />
          <ToolbarInput data-testid="input" />
        </ToolbarGroup>
        <ToolbarButton data-testid="outside" />
      </ToolbarRoot>
    ));
    flush();

    expect(screen.getByRole("group")).toHaveAttribute("data-disabled");
    const inGroup = screen.getByTestId("in-group");
    expect(inGroup).toHaveAttribute("data-disabled");
    fireEvent.click(inGroup);
    expect(onClick).not.toHaveBeenCalled();
    const input = screen.getByTestId("input");
    expect(input).toHaveAttribute("aria-disabled", "true");
    expect(input).not.toHaveAttribute("disabled");

    expect(screen.getByTestId("outside")).not.toHaveAttribute("data-disabled");
    setRootDisabled(true);
    flush();
    expect(screen.getByTestId("outside")).toHaveAttribute("data-disabled");
  });

  it("forwards disabled to a custom component", async () => {
    await render(() => (
      <ToolbarRoot disabled>
        <ToolbarButton as={Toggle} data-testid="toggle" />
      </ToolbarRoot>
    ));
    flush();
    expect(screen.getByTestId("toggle")).toHaveAttribute("data-disabled");
  });

  it("orients the separator opposite to the toolbar unless overridden", async () => {
    await render(() => (
      <ToolbarRoot>
        <ToolbarSeparator data-testid="auto" />
        <ToolbarSeparator data-testid="override" orientation="horizontal" />
      </ToolbarRoot>
    ));
    expect(screen.getByTestId("auto")).toHaveAttribute("aria-orientation", "vertical");
    expect(screen.getByTestId("override")).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("throws when a part is outside the root", async () => {
    await expect(render(() => <ToolbarButton />)).rejects.toThrow(/ToolbarRootContext is missing/);
  });

  describe("reactivity diagnostics", () => {
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warn.mockRestore();
    });

    it("emits no STRICT_READ_UNTRACKED warnings", async () => {
      const [disabled, setDisabled] = createSignal(false);
      await render(() => (
        <ToolbarRoot disabled={disabled()}>
          <ToolbarGroup>
            <ToolbarButton />
            <ToolbarLink href="#" />
            <ToolbarInput />
          </ToolbarGroup>
          <ToolbarSeparator />
        </ToolbarRoot>
      ));
      flush();
      setDisabled(true);
      flush();

      expect(warn.mock.calls.filter((call: unknown[]) => String(call[0]).includes("STRICT_READ_UNTRACKED"))).toEqual([]);
    });
  });
});
