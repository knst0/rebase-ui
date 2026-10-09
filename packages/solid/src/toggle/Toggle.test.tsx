import "@testing-library/jest-dom/vitest";
import { screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { createRenderer, describeConformance } from "#test-utils";

import { ToggleGroup } from "../toggle-group/ToggleGroup";
import { Toggle } from "./Toggle";

describe("<Toggle />", () => {
  const { render } = createRenderer();

  describe("native button", () => {
    describeConformance((props) => <Toggle {...props} />, {
      defaultElement: "button",
      refInstanceof: window.HTMLButtonElement,
    });
  });

  describe("non-native button", () => {
    describeConformance((props) => <Toggle nativeButton={false} as="span" {...props} />, {
      defaultElement: "span",
      as: { targetElement: "section" },
      refInstanceof: window.HTMLSpanElement,
    });
  });

  it("renders a native button with an explicit type by default", async () => {
    await render(() => <Toggle />);

    const button = screen.getByRole("button");
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });

  describe("pressed state", () => {
    it("controlled", async () => {
      const [pressed, setPressed] = createSignal(false);

      await render(() => <Toggle pressed={pressed()} />);

      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("aria-pressed", "false");

      setPressed(true);
      flush();
      expect(button).toHaveAttribute("aria-pressed", "true");

      setPressed(false);
      flush();
      expect(button).toHaveAttribute("aria-pressed", "false");
    });

    it("uncontrolled", async () => {
      const { user } = await render(() => <Toggle defaultPressed={false} />);

      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("aria-pressed", "false");

      await user.click(button);
      flush();
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(button).toHaveAttribute("data-pressed");

      await user.click(button);
      flush();
      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(button).not.toHaveAttribute("data-pressed");
    });
  });

  describe("prop: onPressedChange", () => {
    it("is called when the pressed state changes", async () => {
      const handlePressed = vi.fn();

      const { user } = await render(() => <Toggle defaultPressed={false} onPressedChange={handlePressed} />);

      await user.click(screen.getByRole("button"));
      flush();

      expect(handlePressed).toHaveBeenCalledTimes(1);
      expect(handlePressed.mock.calls[0][0]).toBe(true);
    });

    it("does not change the pressed state when the event is canceled", async () => {
      const { user } = await render(() => (
        <Toggle
          defaultPressed={false}
          onPressedChange={(_pressed, eventDetails) => {
            eventDetails.cancel();
          }}
        />
      ));

      const button = screen.getByRole("button");

      await user.click(button);
      flush();

      expect(button).toHaveAttribute("aria-pressed", "false");
    });

    it("runs the group handler before the consumer callback", async () => {
      const order: string[] = [];

      const { user } = await render(() => (
        <ToggleGroup
          onValueChange={() => {
            order.push("group");
          }}
        >
          <Toggle
            value="one"
            onPressedChange={() => {
              order.push("toggle");
            }}
          />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1] = screen.getAllByRole("button");

      await user.click(button1);
      flush();

      expect(order).toEqual(["group", "toggle"]);
      expect(button1).toHaveAttribute("aria-pressed", "true");
    });

    it("still notifies the consumer when the group change is canceled", async () => {
      const onValueChange = vi.fn((_value: any, eventDetails: ToggleGroup.ChangeEventDetails) => {
        eventDetails.cancel();
      });
      const onPressedChange = vi.fn();

      const { user } = await render(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" onPressedChange={onPressedChange} />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1] = screen.getAllByRole("button");

      await user.click(button1);
      flush();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onPressedChange).toHaveBeenCalledTimes(1);
      expect(button1).toHaveAttribute("aria-pressed", "false");
    });
  });

  describe("prop: disabled", () => {
    it("disables the component", async () => {
      const handlePressed = vi.fn();
      const { user } = await render(() => <Toggle disabled onPressedChange={handlePressed} />);

      const button = screen.getByRole("button");

      expect(button).toHaveAttribute("disabled");
      expect(button).toHaveAttribute("data-disabled");
      expect(button).toHaveAttribute("aria-pressed", "false");

      await user.click(button);
      flush();

      expect(handlePressed).not.toHaveBeenCalled();
      expect(button).toHaveAttribute("aria-pressed", "false");
    });
  });

  describe("prop: class", () => {
    it("resolves a class from the state", async () => {
      await render(() => <Toggle defaultPressed class={(state) => (state.pressed() ? "on" : "off")} />);

      expect(screen.getByRole("button")).toHaveClass("on");
    });
  });

  describe("composite props", () => {
    it("receives a roving tabIndex inside a group", async () => {
      await render(() => (
        <ToggleGroup defaultValue={["left"]}>
          <Toggle value="left" />
          <Toggle value="right" />
        </ToggleGroup>
      ));

      const [button1, button2] = screen.getAllByRole("button");

      expect(button1).toHaveAttribute("tabindex", "0");
      expect(button2).toHaveAttribute("tabindex", "-1");
    });
  });
});
