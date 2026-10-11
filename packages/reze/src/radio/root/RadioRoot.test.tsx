import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Field from "../../field/index.parts";
import { RadioGroup } from "../../radio-group/RadioGroup";
import { RadioIndicator } from "../indicator/RadioIndicator";
import { RadioRoot } from "./RadioRoot";
import * as RadioRootDataAttributes from "./RadioRootDataAttributes";

afterEach(cleanup);

function getRadios(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll('[role="radio"]')] as HTMLElement[];
}

describe("<Radio.Root />", () => {
  it("renders a span that is unchecked with data-unchecked by default", () => {
    const { el } = mount(() => (
      <RadioGroup>
        <RadioRoot value="one" />
      </RadioGroup>
    ));
    tick();

    const [radio] = getRadios(el);
    expect(radio.tagName).toBe("SPAN");
    expect(radio.getAttribute("aria-checked")).toBe("false");
    expect(radio.getAttribute(RadioRootDataAttributes.unchecked)).toBe("");
    expect(radio.hasAttribute(RadioRootDataAttributes.checked)).toBe(false);
  });

  it("reflects the checked state with data-checked", () => {
    const { el } = mount(() => (
      <RadioGroup defaultValue="one">
        <RadioRoot value="one" />
        <RadioRoot value="two" />
      </RadioGroup>
    ));
    tick();

    const [radio1, radio2] = getRadios(el);
    expect(radio1.getAttribute(RadioRootDataAttributes.checked)).toBe("");
    expect(radio1.hasAttribute(RadioRootDataAttributes.unchecked)).toBe(false);
    expect(radio2.getAttribute(RadioRootDataAttributes.unchecked)).toBe("");
  });

  it("renders the indicator only for the checked radio", async () => {
    const { el } = mount(() => (
      <RadioGroup defaultValue="one">
        <RadioRoot value="one">
          <RadioIndicator data-testid="indicator-one" />
        </RadioRoot>
        <RadioRoot value="two">
          <RadioIndicator data-testid="indicator-two" />
        </RadioRoot>
      </RadioGroup>
    ));
    tick();

    expect(el.querySelector('[data-testid="indicator-one"]')).not.toBe(null);
    expect(el.querySelector('[data-testid="indicator-two"]')).toBe(null);

    const [, radio2] = getRadios(el);
    fire(radio2, "click");
    await nextFrames();

    expect(el.querySelector('[data-testid="indicator-one"]')).toBe(null);
    expect(el.querySelector('[data-testid="indicator-two"]')).not.toBe(null);
  });

  it("does not toggle when disabled", () => {
    const onValueChange = vi.fn();
    const { el } = mount(() => (
      <RadioGroup onValueChange={onValueChange}>
        <RadioRoot value="one" disabled />
        <RadioRoot value="two" />
      </RadioGroup>
    ));
    tick();

    const [radio1] = getRadios(el);
    expect(radio1.hasAttribute("data-disabled")).toBe(true);

    fire(radio1, "click");
    tick();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(radio1.getAttribute("aria-checked")).toBe("false");
  });

  it("applies nativeButton ids to the root instead of the hidden input", () => {
    const { el } = mount(() => (
      <RadioGroup>
        <RadioRoot value="one" nativeButton as="button" id="apple-radio" data-testid="radio" />
      </RadioGroup>
    ));
    tick();

    const radio = el.querySelector('[data-testid="radio"]') as HTMLElement;
    expect(radio.tagName).toBe("BUTTON");
    expect(radio.getAttribute("type")).toBe("button");
    expect(radio.getAttribute("id")).toBe("apple-radio");

    const input = el.querySelector('input[type="radio"]') as HTMLInputElement | null;
    expect(input).not.toBe(null);
    expect(input?.id).toBe("");
  });

  it("marks the radio checked when standalone with an empty value", () => {
    const { el } = mount(() => <RadioRoot value="" data-testid="standalone" />);
    tick();

    expect(el.querySelector('[data-testid="standalone"]')?.getAttribute("aria-checked")).toBe("true");
  });

  it("prefers `aria-label` over an associated label", () => {
    const { el } = mount(() => (
      <RadioGroup>
        <label>
          <RadioRoot value="a" aria-label="Apple" />
          Apple
        </label>
      </RadioGroup>
    ));
    tick();

    const [radio] = getRadios(el);
    expect(radio.hasAttribute("aria-labelledby")).toBe(false);
    expect(radio.getAttribute("aria-label")).toBe("Apple");
  });

  describe("prop: as", () => {
    it("renders the customized root element", () => {
      const { el } = mount(() => (
        <RadioGroup>
          <RadioRoot value="one" as="div" />
        </RadioGroup>
      ));
      tick();

      expect(getRadios(el)[0].tagName).toBe("DIV");
    });
  });

  describe("prop: class", () => {
    it("calls the class function with the component state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Field.Root name="choice">
          <RadioGroup defaultValue="one">
            <RadioRoot
              value="one"
              class={(state) => {
                stateArgument = state;
                return "";
              }}
            />
          </RadioGroup>
        </Field.Root>
      ));
      tick();

      expect(getRadios(el)).toHaveLength(1);
      expect(stateArgument).toEqual({
        disabled: false,
        touched: false,
        dirty: false,
        valid: null,
        filled: true,
        focused: false,
        validating: false,
        checked: true,
        readOnly: false,
        required: false,
      });
    });
  });

  describe("prop forwarding", () => {
    it("forwards custom props to the root element", () => {
      const { el } = mount(() => (
        <RadioGroup>
          <RadioRoot value="one" lang="fr" data-foobar="test-value" />
        </RadioGroup>
      ));
      tick();

      const [radio] = getRadios(el);
      expect(radio.getAttribute("lang")).toBe("fr");
      expect(radio.getAttribute("data-foobar")).toBe("test-value");
    });

    it("forwards the style prop", () => {
      const { el } = mount(() => (
        <RadioGroup>
          <RadioRoot value="one" style={{ color: "green" }} />
        </RadioGroup>
      ));
      tick();

      expect(getRadios(el)[0].style.color).toBe("green");
    });

    it("renders children defined as a function of state", () => {
      const { el } = mount(() => (
        <RadioGroup defaultValue="one">
          <RadioRoot value="one">{(state) => <output>{state.checked ? "checked" : "unchecked"}</output>}</RadioRoot>
        </RadioGroup>
      ));
      tick();

      expect(el.querySelector("output")?.textContent).toBe("checked");
    });

    it("forwards event handlers to the root element", () => {
      const onClick = vi.fn();
      const { el } = mount(() => (
        <RadioGroup>
          <RadioRoot value="one" onClick={onClick} />
        </RadioGroup>
      ));
      tick();

      const [radio] = getRadios(el);
      fire(radio, "click");
      tick();

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(radio.getAttribute("aria-checked")).toBe("true");
    });
  });

  describe("ref forwarding", () => {
    it("attaches a callback ref to the root element", () => {
      let instance: HTMLElement | null = null;
      const { el } = mount(() => (
        <RadioGroup>
          <RadioRoot
            value="one"
            ref={(value: HTMLElement) => {
              instance = value;
            }}
          />
        </RadioGroup>
      ));
      tick();

      expect(instance).toBe(getRadios(el)[0]);
    });

    it("exposes the hidden input through inputRef", () => {
      let instance: HTMLInputElement | null = null;
      const { el } = mount(() => (
        <RadioGroup>
          <RadioRoot
            value="one"
            inputRef={(value: HTMLInputElement) => {
              instance = value;
            }}
          />
        </RadioGroup>
      ));
      tick();

      expect(instance).toBe(el.querySelector('input[type="radio"]'));
    });
  });
});
