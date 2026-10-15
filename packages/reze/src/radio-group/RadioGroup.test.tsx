import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as Radio from "../radio/index.parts";
import { RadioGroup } from "./RadioGroup";

afterEach(cleanup);

function getGroup(root: ParentNode): HTMLElement {
  const found = root.querySelector('[role="radiogroup"]');
  if (!(found instanceof HTMLElement)) {
    throw new Error("radiogroup not found");
  }
  return found;
}

function getRadios(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll('[role="radio"]')] as HTMLElement[];
}

describe("<RadioGroup />", () => {
  it("renders a div with radiogroup semantics and no selection by default", () => {
    const { el } = mount(() => (
      <RadioGroup>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));
    tick();

    const group = getGroup(el);
    expect(group.tagName).toBe("DIV");

    const [radio1, radio2] = getRadios(el);
    expect(radio1.getAttribute("aria-checked")).toBe("false");
    expect(radio2.getAttribute("aria-checked")).toBe("false");
  });

  it("selects the defaultValue radio", () => {
    const { el } = mount(() => (
      <RadioGroup defaultValue="two">
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));
    tick();

    const [radio1, radio2] = getRadios(el);
    expect(radio1.getAttribute("aria-checked")).toBe("false");
    expect(radio2.getAttribute("aria-checked")).toBe("true");
    expect(radio2.hasAttribute("data-checked")).toBe(true);
    expect(radio1.hasAttribute("data-unchecked")).toBe(true);
  });

  it("makes the checked radio the only tab stop", () => {
    const { el } = mount(() => (
      <RadioGroup defaultValue="two">
        <Radio.Root value="one" />
        <Radio.Root value="two" />
        <Radio.Root value="three" />
      </RadioGroup>
    ));
    tick();

    expect(getRadios(el).map((radio) => radio.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
  });

  it("makes the first enabled radio the tab stop when nothing is selected", () => {
    const { el } = mount(() => (
      <RadioGroup>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));
    tick();

    expect(getRadios(el).map((radio) => radio.getAttribute("tabindex"))).toEqual(["0", "-1"]);
  });

  it("changes selection on click and fires onValueChange", () => {
    const onValueChange = vi.fn();
    const { el } = mount(() => (
      <RadioGroup defaultValue="one" onValueChange={onValueChange}>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));
    tick();

    const [radio1, radio2] = getRadios(el);

    fire(radio2, "click");
    tick();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe("two");
    expect(radio1.getAttribute("aria-checked")).toBe("false");
    expect(radio2.getAttribute("aria-checked")).toBe("true");
  });

  it("does not change the value when the event is canceled", () => {
    const onValueChange = vi.fn((_value: string, eventDetails: RadioGroup.ChangeEventDetails) => {
      eventDetails.cancel();
    });
    const { el } = mount(() => (
      <form data-testid="form">
        <RadioGroup name="choice" defaultValue="one" onValueChange={onValueChange}>
          <Radio.Root value="one" />
          <Radio.Root value="two" />
        </RadioGroup>
      </form>
    ));
    tick();

    const [radio1, radio2] = getRadios(el);

    fire(radio2, "click");
    tick();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(radio1.getAttribute("aria-checked")).toBe("true");
    expect(radio2.getAttribute("aria-checked")).toBe("false");
    expect(new FormData(el.querySelector("form") as HTMLFormElement).get("choice")).toBe("one");
  });

  it("supports a controlled value", () => {
    function Test() {
      let value: string | undefined = signal("one");
      return (
        <>
          <RadioGroup value={value}>
            <Radio.Root value="one" />
            <Radio.Root value="two" />
          </RadioGroup>
          <button onClick={() => (value = "two")}>Select two</button>
        </>
      );
    }
    const { el } = mount(() => <Test />);
    tick();

    const [radio1, radio2] = getRadios(el);
    expect(radio1.getAttribute("aria-checked")).toBe("true");

    fire(el.querySelector("button")!, "click");
    tick();

    expect(radio1.getAttribute("aria-checked")).toBe("false");
    expect(radio2.getAttribute("aria-checked")).toBe("true");
  });

  it("does not change a controlled value on its own", () => {
    const onValueChange = vi.fn();
    const { el } = mount(() => (
      <form data-testid="form">
        <RadioGroup name="choice" value="one" onValueChange={onValueChange}>
          <Radio.Root value="one" />
          <Radio.Root value="two" />
        </RadioGroup>
      </form>
    ));
    tick();

    const [radio1, radio2] = getRadios(el);

    fire(radio2, "click");
    tick();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(radio1.getAttribute("aria-checked")).toBe("true");
    expect(radio2.getAttribute("aria-checked")).toBe("false");
    expect(new FormData(el.querySelector("form") as HTMLFormElement).get("choice")).toBe("one");
  });

  it("disables the whole group", () => {
    const onValueChange = vi.fn();
    const { el } = mount(() => (
      <RadioGroup disabled onValueChange={onValueChange}>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));
    tick();

    const [radio1, radio2] = getRadios(el);
    expect(radio1.hasAttribute("data-disabled")).toBe(true);
    expect(radio2.hasAttribute("data-disabled")).toBe(true);

    fire(radio1, "click");
    tick();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(radio1.getAttribute("aria-checked")).toBe("false");
  });

  it("does not change the value when readOnly", () => {
    const onValueChange = vi.fn();
    const { el } = mount(() => (
      <RadioGroup defaultValue="one" readOnly onValueChange={onValueChange}>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));
    tick();

    const [, radio2] = getRadios(el);

    fire(radio2, "click");
    tick();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(radio2.getAttribute("aria-checked")).toBe("false");
  });

  it("renders hidden inputs carrying the group name and serialized value", () => {
    const { el } = mount(() => (
      <RadioGroup name="fruits" defaultValue="apple">
        <Radio.Root value="apple" />
        <Radio.Root value={{ id: "orange" }} />
      </RadioGroup>
    ));
    tick();

    const inputs = [...el.querySelectorAll('input[type="radio"][name="fruits"]')] as HTMLInputElement[];
    expect(inputs).toHaveLength(2);
    expect(inputs[0].getAttribute("value")).toBe("apple");
    expect(inputs[1].getAttribute("value")).toBe('{"id":"orange"}');
    expect(inputs[0].checked).toBe(true);
  });

  it("moves focus with arrow keys and selects the focused radio", () => {
    const { el } = mount(() => (
      <RadioGroup defaultValue="one">
        <Radio.Root value="one" />
        <Radio.Root value="two" />
        <Radio.Root value="three" />
      </RadioGroup>
    ));
    tick();

    const [radio1, radio2, radio3] = getRadios(el);

    (el.querySelector('[role="radio"][tabindex="0"]') as HTMLElement).focus();
    tick();
    expect(document.activeElement).toBe(radio1);

    fire(radio1, "keydown", { key: "ArrowRight" } as KeyboardEventInit);
    tick();
    expect(document.activeElement).toBe(radio2);
    expect(radio2.getAttribute("aria-checked")).toBe("true");

    fire(radio2, "keydown", { key: "ArrowRight" } as KeyboardEventInit);
    tick();
    expect(document.activeElement).toBe(radio3);
    expect(radio3.getAttribute("aria-checked")).toBe("true");

    fire(radio3, "keydown", { key: "ArrowLeft" } as KeyboardEventInit);
    tick();
    expect(document.activeElement).toBe(radio2);
    expect(radio2.getAttribute("aria-checked")).toBe("true");
  });

  it("loops arrow-key navigation from the last radio to the first", () => {
    const { el } = mount(() => (
      <RadioGroup defaultValue="three">
        <Radio.Root value="one" />
        <Radio.Root value="two" />
        <Radio.Root value="three" />
      </RadioGroup>
    ));
    tick();

    const [radio1, , radio3] = getRadios(el);

    radio3.focus();
    tick();

    fire(radio3, "keydown", { key: "ArrowDown" } as KeyboardEventInit);
    tick();
    expect(document.activeElement).toBe(radio1);
    expect(radio1.getAttribute("aria-checked")).toBe("true");
  });

  it("skips disabled radios during arrow-key navigation", () => {
    const { el } = mount(() => (
      <RadioGroup defaultValue="one">
        <Radio.Root value="one" />
        <Radio.Root value="two" disabled />
        <Radio.Root value="three" />
      </RadioGroup>
    ));
    tick();

    const [radio1, , radio3] = getRadios(el);

    radio1.focus();
    tick();

    fire(radio1, "keydown", { key: "ArrowRight" } as KeyboardEventInit);
    tick();
    expect(document.activeElement).toBe(radio3);
    expect(radio3.getAttribute("aria-checked")).toBe("true");
  });

  it("selects the focused radio with Space but not with Enter", () => {
    const { el } = mount(() => (
      <RadioGroup>
        <Radio.Root value="one" />
        <Radio.Root value="two" />
      </RadioGroup>
    ));
    tick();

    const [, radio2] = getRadios(el);

    radio2.focus();
    tick();

    fire(radio2, "keydown", { key: " " } as KeyboardEventInit);
    fire(radio2, "keyup", { key: " " } as KeyboardEventInit);
    tick();
    expect(radio2.getAttribute("aria-checked")).toBe("true");

    fire(radio2, "keydown", { key: "Enter" } as KeyboardEventInit);
    fire(radio2, "keyup", { key: "Enter" } as KeyboardEventInit);
    tick();
    expect(radio2.getAttribute("aria-checked")).toBe("true");
  });

  it("transfers the current input to a new inputRef without calling the previous ref", () => {
    const oldRef = vi.fn();
    const newRef = vi.fn();
    function Test() {
      // A function cannot live in a signal, so switch on a boolean.
      let useNewRef = signal(false);
      return (
        <>
          <RadioGroup defaultValue="b" inputRef={useNewRef ? newRef : oldRef}>
            <Radio.Root value="a" />
            <Radio.Root value="b" />
          </RadioGroup>
          <button onClick={() => (useNewRef = true)}>Swap ref</button>
        </>
      );
    }
    const { el } = mount(() => <Test />);
    tick();

    const calls = oldRef.mock.calls as [HTMLInputElement | null][];
    const input = calls[calls.length - 1][0];
    expect(input?.getAttribute("value")).toBe("b");
    oldRef.mockClear();

    fire(el.querySelector("button")!, "click");
    tick();

    expect(newRef).toHaveBeenLastCalledWith(input);
    expect(oldRef).not.toHaveBeenCalled();

    const [radioA] = getRadios(el);
    fire(radioA, "click");
    tick();

    const inputA = el.querySelector('input[type="radio"][value="a"]');
    expect(newRef).toHaveBeenLastCalledWith(inputA);
    expect(oldRef).not.toHaveBeenCalled();
  });

  it("detaches inputRef with null when the forwarded input unmounts", () => {
    const inputRef = vi.fn();
    const { dispose } = mount(() => (
      <RadioGroup defaultValue="a" inputRef={inputRef}>
        <Radio.Root value="a" />
        <Radio.Root value="b" />
      </RadioGroup>
    ));
    tick();

    const calls = inputRef.mock.calls as [HTMLInputElement | null][];
    expect(calls[calls.length - 1][0]?.getAttribute("value")).toBe("a");
    inputRef.mockClear();

    dispose();
    tick();

    expect(inputRef).toHaveBeenCalledTimes(1);
    expect(inputRef).toHaveBeenCalledWith(null);
  });

  describe("prop: as", () => {
    it("renders the customized root element", () => {
      const { el } = mount(() => (
        <RadioGroup as="section">
          <Radio.Root value="one" />
        </RadioGroup>
      ));
      tick();

      expect(getGroup(el).tagName).toBe("SECTION");
    });
  });

  describe("prop: class", () => {
    it("applies the class when passed as a string", () => {
      const { el } = mount(() => <RadioGroup class="test-class" />);
      tick();

      expect(getGroup(el).classList.contains("test-class")).toBe(true);
    });

    it("calls the class function with the component state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <RadioGroup
          class={(state) => {
            stateArgument = state;
            return "";
          }}
        />
      ));
      tick();

      expect(getGroup(el)).toBeTruthy();
      expect(stateArgument).toEqual({
        disabled: false,
        touched: false,
        dirty: false,
        valid: null,
        filled: false,
        focused: false,
        validating: false,
        readOnly: false,
        required: false,
      });
    });
  });

  describe("prop forwarding", () => {
    it("forwards custom props to the root element", () => {
      const { el } = mount(() => <RadioGroup lang="fr" data-foobar="test-value" />);
      tick();

      const group = getGroup(el);
      expect(group.getAttribute("lang")).toBe("fr");
      expect(group.getAttribute("data-foobar")).toBe("test-value");
    });

    it("internal group semantics win over forwarded props", () => {
      const { el } = mount(() => <RadioGroup role="presentation" aria-required="false" />);
      tick();

      const group = getGroup(el);
      expect(group.getAttribute("role")).toBe("radiogroup");
      expect(group.hasAttribute("aria-required")).toBe(false);
    });

    it("forwards the style prop", () => {
      const { el } = mount(() => <RadioGroup style={{ color: "green" }} />);
      tick();

      expect(getGroup(el).style.color).toBe("green");
    });

    it("renders children defined as a function of state", () => {
      function Test() {
        let disabled = signal(false);
        return (
          <>
            <RadioGroup disabled={disabled}>{(state) => <output>{state.disabled ? "disabled" : "enabled"}</output>}</RadioGroup>
            <button onClick={() => (disabled = true)}>Disable</button>
          </>
        );
      }
      const { el } = mount(() => <Test />);
      tick();

      expect(el.querySelector("output")?.textContent).toBe("enabled");

      fire(el.querySelector("button")!, "click");
      tick();

      expect(el.querySelector("output")?.textContent).toBe("disabled");
    });

    it("forwards event handlers to the root element", () => {
      const onClick = vi.fn();
      const { el } = mount(() => <RadioGroup onClick={onClick} />);
      tick();

      fire(getGroup(el), "click");
      tick();

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("fires onBlur when focus leaves the group", () => {
      const onBlur = vi.fn();
      const { el } = mount(() => (
        <>
          <RadioGroup onBlur={onBlur}>
            <Radio.Root value="one" />
            <Radio.Root value="two" />
          </RadioGroup>
          <button>outside</button>
        </>
      ));
      tick();

      const [radio1, radio2] = getRadios(el);
      radio1.focus();
      tick();

      // Moving between radios keeps the group blurred handler quiet.
      radio2.focus();
      tick();
      expect(onBlur).not.toHaveBeenCalled();

      (el.querySelector("button") as HTMLElement).focus();
      tick();
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe("ref forwarding", () => {
    it("attaches a callback ref to the root element", () => {
      let instance: HTMLElement | null = null;
      const { el } = mount(() => (
        <RadioGroup
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        />
      ));
      tick();

      expect(instance).toBe(getGroup(el));
    });

    it("attaches an identifier ref to the root element", () => {
      // oxlint-disable-next-line no-unassigned-vars -- the compiled ref assigns it
      let instance!: HTMLDivElement;
      const { el } = mount(() => <RadioGroup ref={instance} />);
      tick();

      expect(instance).toBe(getGroup(el));
    });
  });
});
