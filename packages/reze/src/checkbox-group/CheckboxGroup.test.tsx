import "@testing-library/jest-dom/vitest";
import { cleanup, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { CheckboxRoot } from "../checkbox/root/CheckboxRoot";
import * as Field from "../field/index.parts";
import { CheckboxGroup } from "./CheckboxGroup";
import * as CheckboxGroupDataAttributes from "./CheckboxGroupDataAttributes";

afterEach(cleanup);

describe("<CheckboxGroup />", () => {
  it("renders a div with group semantics by default", () => {
    mount(() => (
      <CheckboxGroup>
        <CheckboxRoot value="a">A</CheckboxRoot>
      </CheckboxGroup>
    ));
    tick();

    const group = screen.getByRole("group");
    expect(group.tagName).toBe("DIV");
  });

  it("renders the customized group element", () => {
    mount(() => (
      <CheckboxGroup as="section">
        <CheckboxRoot value="a">A</CheckboxRoot>
      </CheckboxGroup>
    ));
    tick();

    expect(screen.getByRole("group").tagName).toBe("SECTION");
  });

  it("takes its accessible name from the field label", () => {
    mount(() => (
      <Field.Root>
        <Field.Label>Preferences</Field.Label>
        <CheckboxGroup>
          <CheckboxRoot value="a">A</CheckboxRoot>
        </CheckboxGroup>
      </Field.Root>
    ));
    tick();

    expect(screen.getByRole("group")).toHaveAccessibleName("Preferences");
  });

  it("selects checkboxes uncontrolled and reports the new value", async () => {
    const handleValueChange = vi.fn();
    const user = userEvent.setup();
    mount(() => (
      <CheckboxGroup defaultValue={["a"]} onValueChange={handleValueChange}>
        <CheckboxRoot value="a">A</CheckboxRoot>
        <CheckboxRoot value="b">B</CheckboxRoot>
      </CheckboxGroup>
    ));
    tick();

    const [first, second] = screen.getAllByRole("checkbox");
    expect(first).toHaveAttribute("aria-checked", "true");
    expect(second).toHaveAttribute("aria-checked", "false");

    await user.click(second);
    tick();

    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange.mock.calls[0][0]).toEqual(["a", "b"]);
    expect(screen.getAllByRole("checkbox")[1]).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getAllByRole("checkbox")[0]);
    tick();

    expect(handleValueChange).toHaveBeenCalledTimes(2);
    expect(handleValueChange.mock.calls[1][0]).toEqual(["b"]);
    expect(screen.getAllByRole("checkbox")[0]).toHaveAttribute("aria-checked", "false");
  });

  it("respects a controlled value", async () => {
    const handleValueChange = vi.fn();
    const user = userEvent.setup();
    mount(() => (
      <CheckboxGroup value={["a"]} onValueChange={handleValueChange}>
        <CheckboxRoot value="a">A</CheckboxRoot>
        <CheckboxRoot value="b">B</CheckboxRoot>
      </CheckboxGroup>
    ));
    tick();

    await user.click(screen.getAllByRole("checkbox")[1]);
    tick();

    expect(handleValueChange).toHaveBeenCalledWith(["a", "b"], expect.anything());
    expect(screen.getAllByRole("checkbox")[1]).toHaveAttribute("aria-checked", "false");
  });

  it("keeps the value when the change is canceled", async () => {
    const user = userEvent.setup();
    mount(() => (
      <CheckboxGroup
        defaultValue={["a"]}
        onValueChange={(_value, details) => {
          details.cancel();
        }}
      >
        <CheckboxRoot value="a">A</CheckboxRoot>
        <CheckboxRoot value="b">B</CheckboxRoot>
      </CheckboxGroup>
    ));
    tick();

    await user.click(screen.getAllByRole("checkbox")[1]);
    tick();

    expect(screen.getAllByRole("checkbox")[1]).toHaveAttribute("aria-checked", "false");
  });

  it("disables every checkbox when the group is disabled", async () => {
    const handleValueChange = vi.fn();
    const user = userEvent.setup();
    mount(() => (
      <CheckboxGroup disabled onValueChange={handleValueChange}>
        <CheckboxRoot value="a">A</CheckboxRoot>
        <CheckboxRoot value="b">B</CheckboxRoot>
      </CheckboxGroup>
    ));
    tick();

    const group = screen.getByRole("group");
    expect(group).toHaveAttribute(CheckboxGroupDataAttributes.disabled, "");

    const [first, second] = screen.getAllByRole("checkbox");
    expect(first).toHaveAttribute("aria-disabled", "true");
    expect(second).toHaveAttribute("aria-disabled", "true");

    await user.click(second);
    tick();

    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it("attaches a callback ref to the group element", () => {
    let instance: HTMLElement | null = null;
    mount(() => (
      <CheckboxGroup
        ref={(value: HTMLElement) => {
          instance = value;
        }}
      >
        <CheckboxRoot value="a">A</CheckboxRoot>
      </CheckboxGroup>
    ));
    tick();

    expect(instance).toBe(screen.getByRole("group"));
  });

  describe("parent checkbox", () => {
    function renderParentGroup(onValueChange?: (value: string[], details: CheckboxGroup.ChangeEventDetails) => void) {
      mount(() => (
        <CheckboxGroup defaultValue={["a"]} allValues={["a", "b"]} onValueChange={onValueChange}>
          <CheckboxRoot parent>All</CheckboxRoot>
          <CheckboxRoot value="a">A</CheckboxRoot>
          <CheckboxRoot value="b">B</CheckboxRoot>
        </CheckboxGroup>
      ));
      tick();
    }

    it("is indeterminate when some children are checked and controls its children", () => {
      renderParentGroup();

      const [parent, first, second] = screen.getAllByRole("checkbox");
      expect(parent).toHaveAttribute("aria-checked", "mixed");
      expect(first).toHaveAttribute("aria-checked", "true");
      expect(second).toHaveAttribute("aria-checked", "false");
      expect(parent).toHaveAttribute("data-parent", "");

      const controls = parent.getAttribute("aria-controls")?.split(" ") ?? [];
      expect(controls).toContain(first.getAttribute("id"));
      expect(controls).toContain(second.getAttribute("id"));
    });

    it("checks all children when clicked from a mixed state, then unchecks them", async () => {
      const handleValueChange = vi.fn();
      const user = userEvent.setup();
      renderParentGroup(handleValueChange);

      await user.click(screen.getAllByRole("checkbox")[0]);
      tick();

      expect(handleValueChange).toHaveBeenLastCalledWith(["a", "b"], expect.anything());
      expect(screen.getAllByRole("checkbox")[0]).toHaveAttribute("aria-checked", "true");
      expect(screen.getAllByRole("checkbox")[2]).toHaveAttribute("aria-checked", "true");

      await user.click(screen.getAllByRole("checkbox")[0]);
      tick();

      expect(handleValueChange).toHaveBeenLastCalledWith([], expect.anything());
      expect(screen.getAllByRole("checkbox")[0]).toHaveAttribute("aria-checked", "false");
      expect(screen.getAllByRole("checkbox")[1]).toHaveAttribute("aria-checked", "false");
    });
  });
});
