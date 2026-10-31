import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { Select } from "../../select";
import { Toggle } from "../../toggle/Toggle";
import { ToolbarButton } from "../button/ToolbarButton";
import { ToolbarGroup } from "../group/ToolbarGroup";
import { ToolbarInput } from "../input/ToolbarInput";
import { ToolbarLink } from "../link/ToolbarLink";
import { ToolbarSeparator } from "../separator/ToolbarSeparator";
import { ToolbarRoot } from "./ToolbarRoot";

afterEach(cleanup);

function press(element: Element, key: string) {
  fire(element, "keydown", { key } as KeyboardEventInit);
  tick();
}

describe("<Toolbar.Root />", () => {
  it("has the toolbar role and orientation attributes", () => {
    mount(() => <ToolbarRoot />);
    const toolbar = screen.getByRole("toolbar");
    expect(toolbar).toHaveAttribute("aria-orientation", "horizontal");
    expect(toolbar).toHaveAttribute("data-orientation", "horizontal");
  });

  it("moves roving focus with arrows and wraps by default", () => {
    mount(() => (
      <ToolbarRoot>
        <ToolbarButton data-testid="one" />
        <ToolbarLink href="#" data-testid="two" />
        <ToolbarButton data-testid="three" />
      </ToolbarRoot>
    ));
    tick();
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

  it("does not wrap when loopFocus is false", () => {
    mount(() => (
      <ToolbarRoot loopFocus={false}>
        <ToolbarButton data-testid="one" />
        <ToolbarButton data-testid="two" />
      </ToolbarRoot>
    ));
    tick();
    const one = screen.getByTestId("one");
    one.focus();
    press(one, "ArrowLeft");
    expect(one).toHaveFocus();
  });

  it("navigates with vertical arrows when vertical", () => {
    mount(() => (
      <ToolbarRoot orientation="vertical">
        <ToolbarButton data-testid="one" />
        <ToolbarButton data-testid="two" />
      </ToolbarRoot>
    ));
    tick();
    const one = screen.getByTestId("one");
    one.focus();
    press(one, "ArrowDown");
    expect(screen.getByTestId("two")).toHaveFocus();
    expect(one).toHaveAttribute("data-orientation", "vertical");
  });

  it("skips disabled items only when they are not focusable", () => {
    function Test() {
      let disabled = signal(false);
      return (
        <>
          <ToolbarRoot>
            <ToolbarButton data-testid="one" />
            <ToolbarButton data-testid="two" disabled={disabled} focusableWhenDisabled={false} />
            <ToolbarButton data-testid="three" disabled />
          </ToolbarRoot>
          <button data-testid="set" onClick={() => (disabled = true)} />
        </>
      );
    }
    mount(() => <Test />);
    tick();
    const one = screen.getByTestId("one");
    one.focus();
    press(one, "ArrowRight");
    expect(screen.getByTestId("two")).toHaveFocus();

    press(screen.getByTestId("two"), "ArrowLeft");
    fire(screen.getByTestId("set"), "click");
    tick();
    press(one, "ArrowRight");
    const three = screen.getByTestId("three");
    expect(three).toHaveFocus();
    expect(three).toHaveAttribute("aria-disabled", "true");
    expect(three).not.toHaveAttribute("disabled");
    expect(three).toHaveAttribute("data-focusable");
  });

  it("propagates disabled from the root and the group", () => {
    const onClick = vi.fn();
    function Test() {
      let rootDisabled = signal(false);
      return (
        <>
          <ToolbarRoot disabled={rootDisabled}>
            <ToolbarGroup disabled>
              <ToolbarButton data-testid="in-group" onClick={onClick} />
              <ToolbarInput data-testid="input" />
            </ToolbarGroup>
            <ToolbarButton data-testid="outside" />
          </ToolbarRoot>
          <button data-testid="set" onClick={() => (rootDisabled = true)} />
        </>
      );
    }
    mount(() => <Test />);
    tick();

    expect(screen.getByRole("group")).toHaveAttribute("data-disabled");
    const inGroup = screen.getByTestId("in-group");
    expect(inGroup).toHaveAttribute("data-disabled");
    fire(inGroup, "click");
    expect(onClick).not.toHaveBeenCalled();
    const input = screen.getByTestId("input");
    expect(input).toHaveAttribute("aria-disabled", "true");
    expect(input).not.toHaveAttribute("disabled");

    expect(screen.getByTestId("outside")).not.toHaveAttribute("data-disabled");
    fire(screen.getByTestId("set"), "click");
    tick();
    expect(screen.getByTestId("outside")).toHaveAttribute("data-disabled");
  });

  it("forwards disabled to a custom component", () => {
    mount(() => (
      <ToolbarRoot disabled>
        <ToolbarButton as={Toggle} data-testid="toggle" />
      </ToolbarRoot>
    ));
    tick();
    expect(screen.getByTestId("toggle")).toHaveAttribute("data-disabled");
  });

  it("orients the separator opposite to the toolbar unless overridden", () => {
    mount(() => (
      <ToolbarRoot>
        <ToolbarSeparator data-testid="auto" />
        <ToolbarSeparator data-testid="override" orientation="horizontal" />
      </ToolbarRoot>
    ));
    expect(screen.getByTestId("auto")).toHaveAttribute("aria-orientation", "vertical");
    expect(screen.getByTestId("override")).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("throws when a part is outside the root", () => {
    expect(() => mount(() => <ToolbarButton />)).toThrow(/ToolbarRootContext is missing/);
  });

  it("keeps outer providers for a button composed with a custom `as`", () => {
    mount(() => (
      <ToolbarRoot>
        <Select.Root defaultValue="a">
          <ToolbarButton as={Select.Trigger} data-testid="select-trigger">
            <Select.Value />
          </ToolbarButton>
        </Select.Root>
      </ToolbarRoot>
    ));
    expect(screen.getByTestId("select-trigger").textContent).toBe("a");
  });
});
