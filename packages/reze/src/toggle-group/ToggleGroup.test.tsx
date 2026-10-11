import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { Toggle } from "../toggle/Toggle";
import { ToggleGroup } from "./ToggleGroup";

afterEach(cleanup);

function getGroup(root: ParentNode): HTMLElement {
  const found = root.querySelector('[role="group"]');
  if (!(found instanceof HTMLElement)) {
    throw new Error("group not found");
  }
  return found;
}

function getButtons(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll('[role="group"] button, [role="group"] [role="button"]')] as HTMLElement[];
}

function pressKey(key: string): void {
  const target = document.activeElement;
  if (!(target instanceof Element)) {
    throw new Error("nothing focused");
  }
  fire(target, "keydown", { key } as KeyboardEventInit);
  tick();
}

/** Simulates keyboard activation: jsdom never turns key events into clicks on native buttons. */
function activate(button: HTMLElement, key: string): void {
  button.focus();
  tick();
  fire(button, "keydown", { key } as KeyboardEventInit);
  fire(button, "click", { detail: 0 } as MouseEventInit);
  fire(button, "keyup", { key } as KeyboardEventInit);
  tick();
}

describe("<ToggleGroup />", () => {
  it("renders a `group`", () => {
    const { el } = mount(() => <ToggleGroup aria-label="My Toggle Group" />);
    tick();

    const group = getGroup(el);
    expect(group.tagName).toBe("DIV");
    expect(group.getAttribute("aria-label")).toBe("My Toggle Group");
    expect(group.getAttribute("data-orientation")).toBe("horizontal");
  });

  describe("uncontrolled", () => {
    it("pressed state", () => {
      const { el } = mount(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2] = getButtons(el);

      expect(button1.getAttribute("aria-pressed")).toBe("false");
      expect(button2.getAttribute("aria-pressed")).toBe("false");

      fire(button1, "click");
      tick();

      expect(button1.getAttribute("aria-pressed")).toBe("true");
      expect(button1.hasAttribute("data-pressed")).toBe(true);
      expect(button2.getAttribute("aria-pressed")).toBe("false");

      fire(button2, "click");
      tick();

      expect(button2.getAttribute("aria-pressed")).toBe("true");
      expect(button2.hasAttribute("data-pressed")).toBe(true);
      expect(button1.getAttribute("aria-pressed")).toBe("false");
    });

    it("prop: defaultValue", () => {
      const { el } = mount(() => (
        <ToggleGroup defaultValue={["two"]}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2] = getButtons(el);

      expect(button2.getAttribute("aria-pressed")).toBe("true");
      expect(button2.hasAttribute("data-pressed")).toBe(true);
      expect(button1.getAttribute("aria-pressed")).toBe("false");

      fire(button1, "click");
      tick();

      expect(button1.getAttribute("aria-pressed")).toBe("true");
      expect(button1.hasAttribute("data-pressed")).toBe(true);
      expect(button2.getAttribute("aria-pressed")).toBe("false");
    });

    it("toggles without a value track their own pressed state", () => {
      const { el } = mount(() => (
        <ToggleGroup>
          <Toggle />
          <Toggle />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2] = getButtons(el);

      expect(button1.getAttribute("aria-pressed")).toBe("false");
      expect(button2.getAttribute("aria-pressed")).toBe("false");

      fire(button1, "click");
      tick();
      expect(button1.getAttribute("aria-pressed")).toBe("true");
      expect(button2.getAttribute("aria-pressed")).toBe("false");

      fire(button2, "click");
      tick();
      expect(button1.getAttribute("aria-pressed")).toBe("true");
      expect(button2.getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("controlled", () => {
    it("pressed state", () => {
      function Test() {
        let value: readonly string[] = signal(["two"]);
        return (
          <>
            <ToggleGroup value={value}>
              <Toggle value="one" />
              <Toggle value="two" />
            </ToggleGroup>
            <button data-testid="set-one" onClick={() => (value = ["one"])}>
              One
            </button>
            <button data-testid="set-two" onClick={() => (value = ["two"])}>
              Two
            </button>
          </>
        );
      }
      const { el } = mount(() => <Test />);
      tick();

      const [button1, button2] = getButtons(el);

      expect(button1.getAttribute("aria-pressed")).toBe("false");
      expect(button2.getAttribute("aria-pressed")).toBe("true");
      expect(button2.hasAttribute("data-pressed")).toBe(true);

      fire(el.querySelector('[data-testid="set-one"]')!, "click");
      tick();

      expect(button1.getAttribute("aria-pressed")).toBe("true");
      expect(button1.hasAttribute("data-pressed")).toBe(true);
      expect(button2.getAttribute("aria-pressed")).toBe("false");

      fire(el.querySelector('[data-testid="set-two"]')!, "click");
      tick();

      expect(button2.getAttribute("aria-pressed")).toBe("true");
      expect(button1.getAttribute("aria-pressed")).toBe("false");
    });

    it("does not change the value on its own", () => {
      const { el } = mount(() => (
        <ToggleGroup value={["two"]}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2] = getButtons(el);

      fire(button1, "click");
      tick();

      expect(button1.getAttribute("aria-pressed")).toBe("false");
      expect(button2.getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("prop: disabled", () => {
    it("can disable the whole group", () => {
      const { el } = mount(() => (
        <ToggleGroup disabled>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2] = getButtons(el);

      expect(button1.hasAttribute("data-disabled")).toBe(true);
      expect(button2.hasAttribute("data-disabled")).toBe(true);
      expect(getGroup(el).hasAttribute("data-disabled")).toBe(true);
    });

    it("can disable individual items", () => {
      const { el } = mount(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" disabled />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2] = getButtons(el) as HTMLButtonElement[];

      expect(button1.hasAttribute("data-disabled")).toBe(false);
      expect(button2.hasAttribute("data-disabled")).toBe(true);
      expect(button2.disabled).toBe(true);
    });
  });

  describe("prop: orientation", () => {
    it("vertical", () => {
      const { el } = mount(() => (
        <ToggleGroup orientation="vertical">
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      tick();

      expect(getGroup(el).getAttribute("data-orientation")).toBe("vertical");
    });

    it('does not render aria-orientation on role="group"', () => {
      const { el } = mount(() => (
        <ToggleGroup orientation="horizontal">
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      tick();

      expect(getGroup(el).hasAttribute("aria-orientation")).toBe(false);
    });
  });

  describe("prop: multiple", () => {
    it("sets data-multiple only when true", () => {
      function Test() {
        let multiple: boolean = signal(false);
        return (
          <>
            <ToggleGroup multiple={multiple}>
              <Toggle value="one" />
            </ToggleGroup>
            <button onClick={() => (multiple = !multiple)}>Flip</button>
          </>
        );
      }
      const { el } = mount(() => <Test />);
      tick();

      const group = getGroup(el);
      expect(group.hasAttribute("data-multiple")).toBe(false);

      fire(el.querySelectorAll("button")[1], "click");
      tick();
      expect(group.hasAttribute("data-multiple")).toBe(true);

      fire(el.querySelectorAll("button")[1], "click");
      tick();
      expect(group.hasAttribute("data-multiple")).toBe(false);
    });

    it("multiple items can be pressed when true", () => {
      const { el } = mount(() => (
        <ToggleGroup multiple defaultValue={["one"]}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2] = getButtons(el);

      expect(button1.getAttribute("aria-pressed")).toBe("true");
      expect(button2.getAttribute("aria-pressed")).toBe("false");

      fire(button2, "click");
      tick();

      expect(button1.getAttribute("aria-pressed")).toBe("true");
      expect(button2.getAttribute("aria-pressed")).toBe("true");
    });

    it("only one item can be pressed when false", () => {
      const { el } = mount(() => (
        <ToggleGroup defaultValue={["one"]}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2] = getButtons(el);

      fire(button2, "click");
      tick();

      expect(button1.getAttribute("aria-pressed")).toBe("false");
      expect(button2.getAttribute("aria-pressed")).toBe("true");
    });

    it("when Toggles omit value", () => {
      const { el } = mount(() => (
        <ToggleGroup multiple>
          <Toggle value="" />
          <Toggle />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2] = getButtons(el);

      fire(button1, "click");
      tick();
      expect(button1.getAttribute("aria-pressed")).toBe("true");
      expect(button2.getAttribute("aria-pressed")).toBe("false");

      fire(button2, "click");
      tick();
      expect(button1.getAttribute("aria-pressed")).toBe("true");
      expect(button2.getAttribute("aria-pressed")).toBe("true");

      fire(button1, "click");
      tick();
      expect(button1.getAttribute("aria-pressed")).toBe("false");
      expect(button2.getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("keyboard interactions", () => {
    (
      [
        ["horizontal", "ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"],
        ["vertical", "ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"],
      ] as const
    ).forEach(([orientation, nextKey, prevKey, ignoredNextKey, ignoredPrevKey]) => {
      it(`orientation: ${orientation}`, () => {
        const { el } = mount(() => (
          <ToggleGroup orientation={orientation}>
            <Toggle value="one" />
            <Toggle value="two" />
            <Toggle value="three" />
          </ToggleGroup>
        ));
        tick();

        const [button1, button2, button3] = getButtons(el);

        button1.focus();
        tick();

        expect(button1.getAttribute("tabindex")).toBe("0");
        expect(document.activeElement).toBe(button1);

        pressKey(nextKey);
        expect(button2.getAttribute("tabindex")).toBe("0");
        expect(document.activeElement).toBe(button2);

        pressKey(nextKey);
        expect(document.activeElement).toBe(button3);

        pressKey(nextKey);
        expect(document.activeElement).toBe(button1);

        pressKey(prevKey);
        expect(document.activeElement).toBe(button3);

        pressKey(prevKey);
        expect(document.activeElement).toBe(button2);

        pressKey(ignoredNextKey);
        expect(document.activeElement).toBe(button2);

        pressKey(ignoredPrevKey);
        expect(document.activeElement).toBe(button2);
      });
    });

    it("prop: loopFocus", () => {
      const { el } = mount(() => (
        <ToggleGroup loopFocus={false}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2] = getButtons(el);

      button1.focus();
      tick();
      expect(document.activeElement).toBe(button1);

      pressKey("ArrowLeft");
      expect(document.activeElement).toBe(button1);

      pressKey("ArrowRight");
      expect(document.activeElement).toBe(button2);

      pressKey("ArrowRight");
      expect(document.activeElement).toBe(button2);
    });

    it("skips disabled items", () => {
      const { el } = mount(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" disabled />
          <Toggle value="three" />
        </ToggleGroup>
      ));
      tick();

      const [button1, , button3] = getButtons(el);

      button1.focus();
      tick();
      expect(document.activeElement).toBe(button1);

      pressKey("ArrowRight");
      expect(document.activeElement).toBe(button3);
    });

    it("Home key moves focus to the first item", () => {
      const { el } = mount(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
          <Toggle value="three" />
        </ToggleGroup>
      ));
      tick();

      const [button1, , button3] = getButtons(el);

      button1.focus();
      tick();
      expect(document.activeElement).toBe(button1);

      pressKey("ArrowRight");
      pressKey("ArrowRight");
      expect(document.activeElement).toBe(button3);

      pressKey("Home");
      expect(button1.getAttribute("tabindex")).toBe("0");
      expect(document.activeElement).toBe(button1);
    });

    it("End key moves focus to the last item", () => {
      const { el } = mount(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
          <Toggle value="three" />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2, button3] = getButtons(el);

      button1.focus();
      tick();
      expect(document.activeElement).toBe(button1);

      pressKey("End");
      expect(button3.getAttribute("tabindex")).toBe("0");
      expect(document.activeElement).toBe(button3);

      pressKey("ArrowLeft");
      expect(document.activeElement).toBe(button2);

      pressKey("End");
      expect(document.activeElement).toBe(button3);
    });

    ["Enter", "Space"].forEach((key) => {
      it(`key: ${key} toggles the pressed state`, () => {
        const { el } = mount(() => (
          <ToggleGroup>
            <Toggle value="one" />
            <Toggle value="two" />
          </ToggleGroup>
        ));
        tick();

        const [button1] = getButtons(el);

        expect(button1.getAttribute("aria-pressed")).toBe("false");

        activate(button1, key === "Space" ? " " : key);
        expect(button1.getAttribute("aria-pressed")).toBe("true");

        activate(button1, key === "Space" ? " " : key);
        expect(button1.getAttribute("aria-pressed")).toBe("false");
      });
    });
  });

  describe("prop: onValueChange", () => {
    it("fires when an item is clicked", () => {
      const onValueChange = vi.fn();
      const { el } = mount(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      tick();

      const [button1, button2] = getButtons(el);

      expect(onValueChange).not.toHaveBeenCalled();

      fire(button1, "click");
      tick();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(["one"]);

      fire(button2, "click");
      tick();

      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(onValueChange.mock.calls[1][0]).toEqual(["two"]);
    });

    it("does not change the value when the event is canceled", () => {
      const onValueChange = vi.fn((_value: unknown, eventDetails: ToggleGroup.ChangeEventDetails) => {
        eventDetails.cancel();
      });

      const { el } = mount(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      tick();

      const [button1] = getButtons(el);

      fire(button1, "click");
      tick();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(button1.getAttribute("aria-pressed")).toBe("false");
    });

    ["Enter", "Space"].forEach((key) => {
      it(`fires when ${key} is pressed`, () => {
        const onValueChange = vi.fn();
        const { el } = mount(() => (
          <ToggleGroup onValueChange={onValueChange}>
            <Toggle value="one" />
            <Toggle value="two" />
          </ToggleGroup>
        ));
        tick();

        const [button1, button2] = getButtons(el);
        const code = key === "Space" ? " " : key;

        activate(button1, code);

        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0][0]).toEqual(["one"]);

        activate(button2, code);

        expect(onValueChange).toHaveBeenCalledTimes(2);
        expect(onValueChange.mock.calls[1][0]).toEqual(["two"]);
      });
    });
  });
});
