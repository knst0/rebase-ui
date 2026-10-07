import "@testing-library/jest-dom/vitest";
import { fireEvent, screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { createRenderer, describeConformance, pressKey } from "#test-utils";

import type { Orientation } from "../internals/types";
import { Toggle } from "../toggle/Toggle";
import { ToggleGroup } from "./ToggleGroup";

async function activate(user: { keyboard: (key: string) => Promise<void> }, button: HTMLElement, key: string) {
  if (key === "Space") {
    await user.keyboard("[Space]");
    flush();
    return;
  }

  fireEvent.keyDown(button, { key: "Enter" });
  fireEvent.click(button, { detail: 0 });
  fireEvent.keyUp(button, { key: "Enter" });
  flush();
}

describe("<ToggleGroup />", () => {
  const { render } = createRenderer();

  describeConformance((props) => <ToggleGroup {...props} />, {
    defaultElement: "div",
    stateAttributes: { "data-orientation": "horizontal" },
  });

  it("renders a `group`", async () => {
    await render(() => <ToggleGroup aria-label="My Toggle Group" />);

    expect(screen.queryByRole("group", { name: "My Toggle Group" })).not.toBe(null);
  });

  describe("uncontrolled", () => {
    it("pressed state", async () => {
      const { user } = await render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      expect(button1).toHaveAttribute("aria-pressed", "false");
      expect(button2).toHaveAttribute("aria-pressed", "false");

      await user.click(button1);
      flush();

      expect(button1).toHaveAttribute("aria-pressed", "true");
      expect(button1).toHaveAttribute("data-pressed");
      expect(button2).toHaveAttribute("aria-pressed", "false");

      await user.click(button2);
      flush();

      expect(button2).toHaveAttribute("aria-pressed", "true");
      expect(button2).toHaveAttribute("data-pressed");
      expect(button1).toHaveAttribute("aria-pressed", "false");
    });

    it("prop: defaultValue", async () => {
      const { user } = await render(() => (
        <ToggleGroup defaultValue={["two"]}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      expect(button2).toHaveAttribute("aria-pressed", "true");
      expect(button2).toHaveAttribute("data-pressed");
      expect(button1).toHaveAttribute("aria-pressed", "false");

      await user.click(button1);
      flush();

      expect(button1).toHaveAttribute("aria-pressed", "true");
      expect(button1).toHaveAttribute("data-pressed");
      expect(button2).toHaveAttribute("aria-pressed", "false");
    });

    it("toggles without a value track their own pressed state", async () => {
      const { user } = await render(() => (
        <ToggleGroup>
          <Toggle />
          <Toggle />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      expect(button1).toHaveAttribute("aria-pressed", "false");
      expect(button2).toHaveAttribute("aria-pressed", "false");

      await user.click(button1);
      flush();
      expect(button1).toHaveAttribute("aria-pressed", "true");
      expect(button2).toHaveAttribute("aria-pressed", "false");

      await user.click(button2);
      flush();
      expect(button1).toHaveAttribute("aria-pressed", "true");
      expect(button2).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("controlled", () => {
    it("pressed state", async () => {
      const [value, setValue] = createSignal<readonly string[]>(["two"]);

      await render(() => (
        <ToggleGroup value={value()}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      expect(button1).toHaveAttribute("aria-pressed", "false");
      expect(button2).toHaveAttribute("aria-pressed", "true");
      expect(button2).toHaveAttribute("data-pressed");

      setValue(["one"]);
      flush();

      expect(button1).toHaveAttribute("aria-pressed", "true");
      expect(button1).toHaveAttribute("data-pressed");
      expect(button2).toHaveAttribute("aria-pressed", "false");

      setValue(["two"]);
      flush();

      expect(button2).toHaveAttribute("aria-pressed", "true");
      expect(button1).toHaveAttribute("aria-pressed", "false");
    });

    it("does not change the value on its own", async () => {
      const { user } = await render(() => (
        <ToggleGroup value={["two"]}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      await user.click(button1);
      flush();

      expect(button1).toHaveAttribute("aria-pressed", "false");
      expect(button2).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("prop: disabled", () => {
    it("can disable the whole group", async () => {
      await render(() => (
        <ToggleGroup disabled>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      expect(button1).toHaveAttribute("data-disabled");
      expect(button2).toHaveAttribute("data-disabled");
      expect(screen.getByRole("group")).toHaveAttribute("data-disabled");
    });

    it("can disable individual items", async () => {
      await render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" disabled />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      expect(button1).not.toHaveAttribute("data-disabled");
      expect(button2).toHaveAttribute("data-disabled");
      expect(button2).toBeDisabled();
    });
  });

  describe("prop: orientation", () => {
    it("vertical", async () => {
      await render(() => (
        <ToggleGroup orientation="vertical">
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      expect(screen.queryByRole("group")).toHaveAttribute("data-orientation", "vertical");
    });

    it('does not render aria-orientation on role="group"', async () => {
      await render(() => (
        <ToggleGroup orientation="horizontal">
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      expect(screen.queryByRole("group")).not.toHaveAttribute("aria-orientation");
    });
  });

  describe("prop: multiple", () => {
    it("sets data-multiple only when true", async () => {
      const [multiple, setMultiple] = createSignal(false);

      await render(() => (
        <ToggleGroup multiple={multiple()}>
          <Toggle value="one" />
        </ToggleGroup>
      ));

      const group = screen.getByRole("group");
      expect(group).not.toHaveAttribute("data-multiple");

      setMultiple(true);
      flush();
      expect(group).toHaveAttribute("data-multiple");

      setMultiple(false);
      flush();
      expect(group).not.toHaveAttribute("data-multiple");
    });

    it("multiple items can be pressed when true", async () => {
      const { user } = await render(() => (
        <ToggleGroup multiple defaultValue={["one"]}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      expect(button1).toHaveAttribute("aria-pressed", "true");
      expect(button2).toHaveAttribute("aria-pressed", "false");

      await user.click(button2);
      flush();

      expect(button1).toHaveAttribute("aria-pressed", "true");
      expect(button2).toHaveAttribute("aria-pressed", "true");
    });

    it("only one item can be pressed when false", async () => {
      const { user } = await render(() => (
        <ToggleGroup defaultValue={["one"]}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      await user.click(button2);
      flush();

      expect(button1).toHaveAttribute("aria-pressed", "false");
      expect(button2).toHaveAttribute("aria-pressed", "true");
    });

    it("when Toggles omit value", async () => {
      const { user } = await render(() => (
        <ToggleGroup multiple>
          <Toggle value="" />
          <Toggle />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      await user.click(button1);
      flush();
      expect(button1).toHaveAttribute("aria-pressed", "true");
      expect(button2).toHaveAttribute("aria-pressed", "false");

      await user.click(button2);
      flush();
      expect(button1).toHaveAttribute("aria-pressed", "true");
      expect(button2).toHaveAttribute("aria-pressed", "true");

      await user.click(button1);
      flush();
      expect(button1).toHaveAttribute("aria-pressed", "false");
      expect(button2).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("keyboard interactions", () => {
    (
      [
        ["horizontal", "ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"],
        ["vertical", "ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"],
      ] as const
    ).forEach(([orientation, nextKey, prevKey, ignoredNextKey, ignoredPrevKey]) => {
      it(`orientation: ${orientation}`, async () => {
        const { user } = await render(() => (
          <ToggleGroup orientation={orientation as Orientation}>
            <Toggle value="one" />
            <Toggle value="two" />
            <Toggle value="three" />
          </ToggleGroup>
        ));

        const [button1, button2, button3] = screen.getAllByRole("button");

        await user.keyboard("[Tab]");

        expect(button1).toHaveAttribute("tabindex", "0");
        expect(button1).toHaveFocus();

        pressKey(nextKey);
        expect(button2).toHaveAttribute("tabindex", "0");
        expect(button2).toHaveFocus();

        pressKey(nextKey);
        expect(button3).toHaveFocus();

        pressKey(nextKey);
        expect(button1).toHaveFocus();

        pressKey(prevKey);
        expect(button3).toHaveFocus();

        pressKey(prevKey);
        expect(button2).toHaveFocus();

        pressKey(ignoredNextKey);
        expect(button2).toHaveFocus();

        pressKey(ignoredPrevKey);
        expect(button2).toHaveFocus();
      });
    });

    it("prop: loopFocus", async () => {
      const { user } = await render(() => (
        <ToggleGroup loopFocus={false}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      await user.keyboard("[Tab]");
      expect(button1).toHaveFocus();

      pressKey("ArrowLeft");
      expect(button1).toHaveFocus();

      pressKey("ArrowRight");
      expect(button2).toHaveFocus();

      pressKey("ArrowRight");
      expect(button2).toHaveFocus();
    });

    it("skips disabled items", async () => {
      const { user } = await render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" disabled />
          <Toggle value="three" />
        </ToggleGroup>
      ));

      const [button1, , button3] = screen.getAllByRole("button");

      await user.keyboard("[Tab]");
      expect(button1).toHaveFocus();

      pressKey("ArrowRight");
      expect(button3).toHaveFocus();
    });

    it("Home key moves focus to the first item", async () => {
      const { user } = await render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
          <Toggle value="three" />
        </ToggleGroup>
      ));

      const [button1, , button3] = screen.getAllByRole("button");

      await user.keyboard("[Tab]");
      expect(button1).toHaveFocus();

      pressKey("ArrowRight");
      pressKey("ArrowRight");
      expect(button3).toHaveFocus();

      pressKey("Home");
      expect(button1).toHaveAttribute("tabindex", "0");
      expect(button1).toHaveFocus();
    });

    it("End key moves focus to the last item", async () => {
      const { user } = await render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
          <Toggle value="three" />
        </ToggleGroup>
      ));

      const [button1, button2, button3] = screen.getAllByRole("button");

      await user.keyboard("[Tab]");
      expect(button1).toHaveFocus();

      pressKey("End");
      expect(button3).toHaveAttribute("tabindex", "0");
      expect(button3).toHaveFocus();

      pressKey("ArrowLeft");
      expect(button2).toHaveFocus();

      pressKey("End");
      expect(button3).toHaveFocus();
    });

    ["Enter", "Space"].forEach((key) => {
      it(`key: ${key} toggles the pressed state`, async () => {
        const { user } = await render(() => (
          <ToggleGroup>
            <Toggle value="one" />
            <Toggle value="two" />
          </ToggleGroup>
        ));

        const [button1] = screen.getAllByRole("button");

        expect(button1).toHaveAttribute("aria-pressed", "false");

        button1.focus();
        flush();

        await activate(user, button1, key);
        expect(button1).toHaveAttribute("aria-pressed", "true");

        await activate(user, button1, key);
        expect(button1).toHaveAttribute("aria-pressed", "false");
      });
    });
  });

  describe("prop: onValueChange", () => {
    it("fires when an item is clicked", async () => {
      const onValueChange = vi.fn();

      const { user } = await render(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      expect(onValueChange).not.toHaveBeenCalled();

      await user.click(button1);
      flush();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(["one"]);

      await user.click(button2);
      flush();

      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(onValueChange.mock.calls[1][0]).toEqual(["two"]);
    });

    it("does not change the value when the event is canceled", async () => {
      const onValueChange = vi.fn((_value: any, eventDetails: ToggleGroup.ChangeEventDetails) => {
        eventDetails.cancel();
      });

      const { user } = await render(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1] = screen.getAllByRole("button");

      await user.click(button1);
      flush();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(button1).toHaveAttribute("aria-pressed", "false");
    });

    ["Enter", "Space"].forEach((key) => {
      it(`fires when ${key} is pressed`, async () => {
        const onValueChange = vi.fn();

        const { user } = await render(() => (
          <ToggleGroup onValueChange={onValueChange}>
            <Toggle value="one" />
            <Toggle value="two" />
          </ToggleGroup>
        ));

        const [button1, button2] = screen.getAllByRole("button");

        button1.focus();
        flush();
        await activate(user, button1, key);

        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0][0]).toEqual(["one"]);

        button2.focus();
        flush();
        await activate(user, button2, key);

        expect(onValueChange).toHaveBeenCalledTimes(2);
        expect(onValueChange.mock.calls[1][0]).toEqual(["two"]);
      });
    });
  });
});
