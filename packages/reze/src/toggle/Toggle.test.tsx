import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { ToggleGroup } from "../toggle-group/ToggleGroup";
import { Toggle } from "./Toggle";

afterEach(cleanup);

function getButtons(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll('button, [role="button"]')] as HTMLElement[];
}

function getButton(root: ParentNode): HTMLElement {
  const [button] = getButtons(root);
  if (!button) {
    throw new Error("button not found");
  }
  return button;
}

describe("<Toggle />", () => {
  it("renders a native button with an explicit type by default", () => {
    const { el } = mount(() => <Toggle />);

    const button = getButton(el);
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
  });

  describe("prop: as", () => {
    it("renders the customized root element", () => {
      const { el } = mount(() => (
        <Toggle nativeButton={false} as="span">
          Save
        </Toggle>
      ));

      const button = getButton(el);
      expect(button.tagName).toBe("SPAN");
      expect(button.getAttribute("role")).toBe("button");
    });

    it("supports component values", () => {
      function Fancy(props: { children?: unknown }) {
        return <section data-fancy="true">{props.children as never}</section>;
      }
      const { el } = mount(() => (
        <Toggle nativeButton={false} as={Fancy}>
          Save
        </Toggle>
      ));

      expect(el.querySelector("section")?.getAttribute("data-fancy")).toBe("true");
    });
  });

  describe("pressed state", () => {
    it("controlled", () => {
      function Test() {
        let pressed: boolean = signal(false);
        return (
          <>
            <Toggle pressed={pressed} />
            <button onClick={() => (pressed = !pressed)}>Flip</button>
          </>
        );
      }
      const { el } = mount(() => <Test />);

      const [toggle, flip] = getButtons(el);
      expect(toggle.getAttribute("aria-pressed")).toBe("false");

      fire(flip, "click");
      tick();
      expect(toggle.getAttribute("aria-pressed")).toBe("true");

      fire(flip, "click");
      tick();
      expect(toggle.getAttribute("aria-pressed")).toBe("false");
    });

    it("uncontrolled", () => {
      const { el } = mount(() => <Toggle defaultPressed={false} />);

      const button = getButton(el);
      expect(button.getAttribute("aria-pressed")).toBe("false");

      fire(button, "click");
      tick();
      expect(button.getAttribute("aria-pressed")).toBe("true");
      expect(button.hasAttribute("data-pressed")).toBe(true);

      fire(button, "click");
      tick();
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(button.hasAttribute("data-pressed")).toBe(false);
    });
  });

  describe("prop: onPressedChange", () => {
    it("is called when the pressed state changes", () => {
      const handlePressed = vi.fn();
      const { el } = mount(() => <Toggle defaultPressed={false} onPressedChange={handlePressed} />);

      fire(getButton(el), "click");
      tick();

      expect(handlePressed).toHaveBeenCalledTimes(1);
      expect(handlePressed.mock.calls[0][0]).toBe(true);
    });

    it("does not change the pressed state when the event is canceled", () => {
      const { el } = mount(() => (
        <Toggle
          defaultPressed={false}
          onPressedChange={(_pressed, eventDetails) => {
            eventDetails.cancel();
          }}
        />
      ));

      const button = getButton(el);

      fire(button, "click");
      tick();

      expect(button.getAttribute("aria-pressed")).toBe("false");
    });

    it("runs the group handler before the consumer callback", () => {
      const order: string[] = [];
      const { el } = mount(() => (
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
      tick();

      const [button1] = getButtons(el);

      fire(button1, "click");
      tick();

      expect(order).toEqual(["group", "toggle"]);
      expect(button1.getAttribute("aria-pressed")).toBe("true");
    });

    it("still notifies the consumer when the group change is canceled", () => {
      const onValueChange = vi.fn((_value: unknown, eventDetails: ToggleGroup.ChangeEventDetails) => {
        eventDetails.cancel();
      });
      const onPressedChange = vi.fn();
      const { el } = mount(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" onPressedChange={onPressedChange} />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      tick();

      const [button1] = getButtons(el);

      fire(button1, "click");
      tick();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onPressedChange).toHaveBeenCalledTimes(1);
      expect(button1.getAttribute("aria-pressed")).toBe("false");
    });
  });

  describe("prop: disabled", () => {
    it("disables the component", () => {
      const handlePressed = vi.fn();
      const { el } = mount(() => <Toggle disabled onPressedChange={handlePressed} />);

      const button = getButton(el);

      expect(button.hasAttribute("disabled")).toBe(true);
      expect(button.hasAttribute("data-disabled")).toBe(true);
      expect(button.getAttribute("aria-pressed")).toBe("false");

      fire(button, "click");
      tick();

      expect(handlePressed).not.toHaveBeenCalled();
      expect(button.getAttribute("aria-pressed")).toBe("false");
    });
  });

  describe("prop: class", () => {
    it("resolves a class from the state", () => {
      const { el } = mount(() => <Toggle defaultPressed class={(state) => (state.pressed ? "on" : "off")} />);

      expect(getButton(el).classList.contains("on")).toBe(true);
    });
  });

  describe("prop forwarding", () => {
    it("renders children defined as a function of state", () => {
      const { el } = mount(() => <Toggle defaultPressed>{(state) => (state.pressed ? "on" : "off")}</Toggle>);

      expect(getButton(el).textContent).toBe("on");
    });
  });

  describe("ref forwarding", () => {
    it("attaches a callback ref to the root element", () => {
      let instance: HTMLElement | null = null;
      const { el } = mount(() => (
        <Toggle
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        />
      ));

      expect(instance).toBe(getButton(el));
      expect(instance).toBeInstanceOf(window.HTMLButtonElement);
    });
  });

  describe("composite props", () => {
    it("receives a roving tabIndex inside a group", () => {
      const { el } = mount(() => (
        <ToggleGroup defaultValue={["left"]}>
          <Toggle value="left" />
          <Toggle value="right" />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2] = getButtons(el);

      expect(button1.getAttribute("tabindex")).toBe("0");
      expect(button2.getAttribute("tabindex")).toBe("-1");
    });
  });
});
