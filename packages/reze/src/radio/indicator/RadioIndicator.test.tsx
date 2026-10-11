import { cleanup, mount, tick } from "@rezejs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import * as Field from "../../field/index.parts";
import { RadioGroup } from "../../radio-group/RadioGroup";
import { RadioRoot } from "../root/RadioRoot";
import { RadioIndicator } from "./RadioIndicator";

afterEach(cleanup);

describe("<Radio.Indicator />", () => {
  it("renders a span that is hidden when the radio is unchecked", () => {
    const { el } = mount(() => (
      <RadioGroup>
        <RadioRoot value="one">
          <RadioIndicator data-testid="indicator" />
        </RadioRoot>
      </RadioGroup>
    ));
    tick();

    expect(el.querySelector('[data-testid="indicator"]')).toBe(null);
  });

  it("is shown when the radio is checked", () => {
    const { el } = mount(() => (
      <RadioGroup defaultValue="one">
        <RadioRoot value="one">
          <RadioIndicator data-testid="indicator" />
        </RadioRoot>
      </RadioGroup>
    ));
    tick();

    const indicator = el.querySelector('[data-testid="indicator"]') as HTMLElement | null;
    expect(indicator).not.toBe(null);
    expect(indicator?.tagName).toBe("SPAN");
  });

  it("stays mounted with keepMounted when the radio is unchecked", () => {
    const { el } = mount(() => (
      <RadioGroup>
        <RadioRoot value="one">
          <RadioIndicator keepMounted data-testid="indicator" />
        </RadioRoot>
      </RadioGroup>
    ));
    tick();

    expect(el.querySelector('[data-testid="indicator"]')).not.toBe(null);
  });

  it("renders the customized root element", () => {
    const { el } = mount(() => (
      <RadioGroup defaultValue="one">
        <RadioRoot value="one">
          <RadioIndicator as="i" data-testid="indicator" />
        </RadioRoot>
      </RadioGroup>
    ));
    tick();

    expect((el.querySelector('[data-testid="indicator"]') as HTMLElement)?.tagName).toBe("I");
  });

  it("calls the class function with the component state", () => {
    let stateArgument: unknown;
    const { el } = mount(() => (
      <Field.Root name="choice">
        <RadioGroup defaultValue="one">
          <RadioRoot value="one">
            <RadioIndicator
              data-testid="indicator"
              class={(state) => {
                stateArgument = state;
                return "";
              }}
            />
          </RadioRoot>
        </RadioGroup>
      </Field.Root>
    ));
    tick();

    expect(el.querySelector('[data-testid="indicator"]')).not.toBe(null);
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
      transitionStatus: undefined,
    });
  });
});
