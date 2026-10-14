import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { Button } from "./Button";
import * as ButtonDataAttributes from "./ButtonDataAttributes";

afterEach(cleanup);

function fireKey(element: Element, type: "keydown" | "keyup", init: KeyboardEventInit): boolean {
  return fire(element, type, init);
}

function getButton(root: ParentNode, name?: string): HTMLElement {
  const candidates = [...root.querySelectorAll("button, [role='button']")] as HTMLElement[];
  const found = name === undefined ? candidates[0] : candidates.find((element) => (element.textContent ?? "").trim() === name);
  if (!found) {
    throw new Error(`button ${name === undefined ? "" : `"${name}" `}not found`);
  }
  return found;
}

describe("<Button />", () => {
  it("renders the default root element with type button", () => {
    const { el } = mount(() => <Button>Submit</Button>);

    const button = getButton(el, "Submit");
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("lets the type prop override the default button type", () => {
    const { el } = mount(() => <Button type="submit">Submit</Button>);

    expect(getButton(el, "Submit").getAttribute("type")).toBe("submit");
  });

  it("does not render state attributes when enabled", () => {
    const { el } = mount(() => <Button>Submit</Button>);

    expect(getButton(el, "Submit").hasAttribute(ButtonDataAttributes.disabled)).toBe(false);
  });

  describe("prop: as", () => {
    it("renders the customized root element", () => {
      const { el } = mount(() => (
        <Button nativeButton={false} as="span">
          Save
        </Button>
      ));

      expect(getButton(el, "Save").tagName).toBe("SPAN");
    });

    it("supports component values", () => {
      function Fancy(props: { children?: unknown }) {
        return <section data-fancy="true">{props.children as never}</section>;
      }
      const { el } = mount(() => (
        <Button nativeButton={false} as={Fancy}>
          Save
        </Button>
      ));

      const section = el.querySelector("section");
      expect(section?.getAttribute("data-fancy")).toBe("true");
      expect(section?.textContent).toBe("Save");
    });
  });

  describe("prop: class", () => {
    it("applies the class when passed as a string", () => {
      const { el } = mount(() => <Button class="test-class">Save</Button>);

      expect(getButton(el, "Save").classList.contains("test-class")).toBe(true);
    });

    it("applies the class when passed as a function of state", () => {
      const { el } = mount(() => <Button class={() => "test-class"}>Save</Button>);

      expect(getButton(el, "Save").classList.contains("test-class")).toBe(true);
    });

    it("calls the class function with the component state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Button
          disabled
          class={(state) => {
            stateArgument = state;
            return "";
          }}
        >
          Save
        </Button>
      ));

      expect(getButton(el, "Save")).toBeTruthy();
      expect(stateArgument).toEqual({ disabled: true });
    });

    it("applies every class when passed as an array", () => {
      const { el } = mount(() => <Button class={["test-class-1", () => "test-class-2"]}>Save</Button>);

      const button = getButton(el, "Save");
      expect(button.classList.contains("test-class-1")).toBe(true);
      expect(button.classList.contains("test-class-2")).toBe(true);
    });

    it("updates the class when the state changes", () => {
      function TestButton() {
        let disabled = signal(false);
        return (
          <>
            <Button disabled={disabled} class={(state) => (state.disabled ? "is-disabled" : "is-enabled")}>
              Save
            </Button>
            <button onClick={() => (disabled = true)}>Disable</button>
          </>
        );
      }
      const { el } = mount(() => <TestButton />);

      const button = getButton(el, "Save");
      expect(button.classList.contains("is-enabled")).toBe(true);

      fire(getButton(el, "Disable"), "click");
      tick();

      expect(button.classList.contains("is-disabled")).toBe(true);
      expect(button.classList.contains("is-enabled")).toBe(false);
    });
  });

  describe("prop forwarding", () => {
    it("forwards custom props to the root element", () => {
      const { el } = mount(() => (
        <Button lang="fr" data-foobar="test-value">
          Save
        </Button>
      ));

      const button = getButton(el, "Save");
      expect(button.getAttribute("lang")).toBe("fr");
      expect(button.getAttribute("data-foobar")).toBe("test-value");
    });

    it("forwards aria props to the root element", () => {
      const { el } = mount(() => <Button aria-label="Test label">Save</Button>);

      expect(getButton(el, "Save").getAttribute("aria-label")).toBe("Test label");
    });

    it("forwards the style prop", () => {
      const { el } = mount(() => <Button style={{ color: "green" }}>Save</Button>);

      expect((getButton(el, "Save") as HTMLElement).style.color).toBe("green");
    });

    it("forwards the style prop defined as a function of state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Button
          style={(state) => {
            stateArgument = state;
            return { color: "green" };
          }}
        >
          Save
        </Button>
      ));

      expect((getButton(el, "Save") as HTMLElement).style.color).toBe("green");
      expect(stateArgument).toEqual({ disabled: false });
    });

    it("forwards event handlers to the root element", () => {
      const handleClick = vi.fn();
      const { el } = mount(() => <Button onClick={handleClick}>Save</Button>);

      fire(getButton(el, "Save"), "click");

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("renders children defined as a function of state", () => {
      const { el } = mount(() => <Button disabled>{(state) => (state.disabled ? "Off" : "On")}</Button>);

      expect(getButton(el, "Off")).toBeTruthy();
    });
  });

  describe("ref forwarding", () => {
    it("attaches a callback ref to the root element", () => {
      let instance: HTMLElement | null = null;
      const { el } = mount(() => (
        <Button
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        >
          Save
        </Button>
      ));

      const button = getButton(el, "Save");
      expect(instance).toBe(button);
      expect(instance).toBeInstanceOf(window.HTMLButtonElement);
    });

    it("attaches an identifier ref to the root element", () => {
      // oxlint-disable-next-line no-unassigned-vars -- the compiled ref assigns it
      let instance!: HTMLButtonElement;
      const { el } = mount(() => <Button ref={instance}>Save</Button>);

      expect(instance).toBe(getButton(el, "Save"));
    });

    it("keeps forwarding the other props when a ref is provided", () => {
      const { el } = mount(() => (
        <Button ref={() => {}} data-foobar="test-value">
          Save
        </Button>
      ));

      expect(getButton(el, "Save").getAttribute("data-foobar")).toBe("test-value");
    });
  });

  describe("prop: nativeButton", () => {
    it("custom link element: Space activates the link without scrolling the page", () => {
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const { el } = mount(() => (
        <Button as="a" nativeButton={false} onClick={handleClick} onKeyDown={handleKeyDown}>
          Go
        </Button>
      ));

      const link = getButton(el, "Go");
      expect(link.tagName).toBe("A");

      fireKey(link, "keydown", { key: " " });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleKeyDown.mock.calls[0][0].defaultPrevented).toBe(true);

      fireKey(link, "keyup", { key: " " });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("custom element: applies button semantics and dispatches real clicks from keyboard activation", () => {
      const handleClick = vi.fn();
      const handleAncestorClick = vi.fn();
      const { el } = mount(() => (
        <div onClick={handleAncestorClick}>
          <Button as="span" nativeButton={false} onClick={handleClick}>
            Save
          </Button>
        </div>
      ));

      const button = getButton(el, "Save");

      expect(button.tagName).toBe("SPAN");
      expect(button.getAttribute("role")).toBe("button");
      expect(button.getAttribute("tabindex")).toBe("0");

      fireKey(button, "keydown", { key: "Enter" });
      fireKey(button, "keydown", { key: " " });
      fireKey(button, "keyup", { key: " " });

      expect(handleClick).toHaveBeenCalledTimes(2);
      expect(handleAncestorClick).toHaveBeenCalledTimes(2);
    });

    it("custom element: keyboard activation clicks carry modifier key state", () => {
      const handleClick = vi.fn();
      const { el } = mount(() => (
        <Button as="span" nativeButton={false} onClick={handleClick}>
          Save
        </Button>
      ));

      const button = getButton(el, "Save");

      fireKey(button, "keydown", { key: "Enter", shiftKey: true });

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick.mock.calls[0][0].shiftKey).toBe(true);
    });
  });

  describe("prop: disabled", () => {
    it("native button: uses the disabled attribute and is not focusable", () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();
      const { el } = mount(() => (
        <Button disabled onClick={handleClick} onMouseDown={handleMouseDown} onPointerDown={handlePointerDown} onKeyDown={handleKeyDown}>
          Save
        </Button>
      ));

      const button = getButton(el, "Save") as HTMLButtonElement;

      expect(button.hasAttribute("disabled")).toBe(true);
      expect(button.disabled).toBe(true);
      expect(button.hasAttribute(ButtonDataAttributes.disabled)).toBe(true);
      expect(button.hasAttribute("aria-disabled")).toBe(false);

      fire(button, "click");
      fire(button, "mousedown");
      fire(button, "pointerdown");
      fireKey(button, "keydown", { key: "Enter" });
      fireKey(button, "keyup", { key: " " });

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleMouseDown).not.toHaveBeenCalled();
      expect(handlePointerDown).not.toHaveBeenCalled();
      expect(handleKeyDown).not.toHaveBeenCalled();
    });

    it("custom element: applies aria-disabled and is not focusable", () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();
      const { el } = mount(() => (
        <Button
          disabled
          nativeButton={false}
          as="span"
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
        >
          Save
        </Button>
      ));

      const button = getButton(el, "Save");

      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.hasAttribute(ButtonDataAttributes.disabled)).toBe(true);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("tabindex")).toBe("-1");

      fire(button, "click");
      fire(button, "mousedown");
      fire(button, "pointerdown");
      fireKey(button, "keydown", { key: "Enter" });
      fireKey(button, "keyup", { key: " " });

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleMouseDown).not.toHaveBeenCalled();
      expect(handlePointerDown).not.toHaveBeenCalled();
      expect(handleKeyDown).not.toHaveBeenCalled();
    });
  });

  describe("prop: focusableWhenDisabled", () => {
    it("native button: prevents interactions but remains focusable", () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();
      const { el } = mount(() => (
        <Button
          disabled
          focusableWhenDisabled
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
        >
          Save
        </Button>
      ));

      const button = getButton(el, "Save") as HTMLButtonElement;

      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.disabled).toBe(false);
      expect(button.hasAttribute(ButtonDataAttributes.disabled)).toBe(true);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("tabindex")).toBe("0");

      button.focus();
      expect(document.activeElement).toBe(button);

      fire(button, "click");
      fire(button, "mousedown");
      fire(button, "pointerdown");
      fireKey(button, "keydown", { key: "Enter" });
      fireKey(button, "keyup", { key: " " });

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleMouseDown).not.toHaveBeenCalled();
      expect(handlePointerDown).not.toHaveBeenCalled();
      expect(handleKeyDown).not.toHaveBeenCalled();
    });

    it("keeps focus and suppresses interactions after becoming disabled", () => {
      const handleClick = vi.fn();
      function TestButton() {
        let disabled = signal(false);
        return (
          <Button
            disabled={disabled}
            focusableWhenDisabled
            onClick={() => {
              handleClick();
              disabled = true;
            }}
          >
            Save
          </Button>
        );
      }
      const { el } = mount(() => <TestButton />);

      const button = getButton(el, "Save");

      fire(button, "click");
      tick();

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(button.getAttribute("aria-disabled")).toBe("true");

      (button as HTMLElement).focus();
      fire(button, "click");
      fireKey(button, "keydown", { key: "Enter" });
      fireKey(button, "keyup", { key: " " });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("reacts to focusableWhenDisabled changes after mount", () => {
      function TestButton() {
        let focusable = signal(false);
        return (
          <>
            <Button disabled focusableWhenDisabled={focusable}>
              Save
            </Button>
            <button onClick={() => (focusable = true)}>Make focusable</button>
          </>
        );
      }
      const { el } = mount(() => <TestButton />);

      const button = getButton(el, "Save") as HTMLButtonElement;
      expect(button.hasAttribute("disabled")).toBe(true);

      fire(getButton(el, "Make focusable"), "click");
      tick();

      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("tabindex")).toBe("0");
    });

    it("custom element: prevents interactions but remains focusable", () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();
      const { el } = mount(() => (
        <Button
          disabled
          focusableWhenDisabled
          nativeButton={false}
          as="span"
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
        >
          Save
        </Button>
      ));

      const button = getButton(el, "Save");

      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.hasAttribute(ButtonDataAttributes.disabled)).toBe(true);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("tabindex")).toBe("0");

      button.focus();
      fire(button, "click");
      fire(button, "mousedown");
      fire(button, "pointerdown");
      fireKey(button, "keydown", { key: "Enter" });
      fireKey(button, "keyup", { key: " " });

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleMouseDown).not.toHaveBeenCalled();
      expect(handlePointerDown).not.toHaveBeenCalled();
      expect(handleKeyDown).not.toHaveBeenCalled();
    });
  });
});
