import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { REASONS } from "../../internals/event-details";
import { OTPField } from "../index";
import type { OTPFieldRoot } from "../root/OTPFieldRoot";

afterEach(cleanup);

const OTP_LENGTH = 6;

function OTPFixture(props: Partial<OTPFieldRoot.Props> = {}) {
  const rootProps = { length: OTP_LENGTH, ...props } as OTPFieldRoot.Props;
  return (
    <OTPField.Root {...rootProps}>
      {Array.from({ length: OTP_LENGTH }, (_, index) => (
        <OTPField.Input aria-label={index === 0 ? undefined : `Character ${index + 1} of ${OTP_LENGTH}`} />
      ))}
    </OTPField.Root>
  );
}

function slotInputs() {
  return Array.from(screen.getByRole("group").querySelectorAll("input")) as HTMLInputElement[];
}

function slotValues() {
  return slotInputs().map((input) => input.value);
}

async function settle() {
  // Deferred focus moves run in a microtask after the value-change effect.
  tick();
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
  tick();
}

async function inputInto(input: HTMLInputElement, value: string) {
  input.value = value;
  fire(input, "input");
  await settle();
}

function compositionStart(input: HTMLInputElement) {
  fire(input, "compositionstart");
  tick();
}

async function compositionEnd(input: HTMLInputElement, value: string) {
  input.value = value;
  fire(input, "compositionend");
  await settle();
}

describe("<OTPField.Input /> IME composition", () => {
  it("commits an IME composition once on compositionend instead of per intermediate change", async () => {
    const onValueChange = vi.fn();

    mount(() => <OTPFixture validationType="alphanumeric" onValueChange={onValueChange} />);
    await settle();

    const inputs = slotInputs();
    const firstInput = inputs[0];
    firstInput.focus();

    compositionStart(firstInput);

    // Safari can surface in-progress IME text through `input` as an accumulating string.
    await inputInto(firstInput, "d");
    await inputInto(firstInput, "dd");
    await inputInto(firstInput, "ddd");

    // No value commits while the composition is active; the text is only buffered for display.
    expect(onValueChange).not.toHaveBeenCalled();
    expect(slotValues()).toEqual(["ddd", "", "", "", "", ""]);

    await compositionEnd(firstInput, "ddd");

    // The final composed value commits once across three slots, not six.
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("ddd", expect.anything());
    expect(slotValues()).toEqual(["d", "d", "d", "", "", ""]);
    expect(document.activeElement).toBe(inputs[3]);
  });

  it("reports characters rejected from a committed IME composition", async () => {
    const onValueChange = vi.fn();
    const onValueInvalid = vi.fn();

    mount(() => <OTPFixture onValueChange={onValueChange} onValueInvalid={onValueInvalid} />);
    await settle();

    const inputs = slotInputs();
    const firstInput = inputs[0];
    firstInput.focus();

    compositionStart(firstInput);
    await inputInto(firstInput, "1a");

    expect(onValueInvalid).not.toHaveBeenCalled();

    await compositionEnd(firstInput, "1a");

    expect(onValueInvalid).toHaveBeenCalledTimes(1);
    expect(onValueInvalid.mock.calls[0]?.[0]).toBe("1a");
    expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("1", expect.anything());
    expect(slotValues()).toEqual(["1", "", "", "", "", ""]);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it("ignores keyboard commands while a composition is buffered", async () => {
    const onValueChange = vi.fn();

    mount(() => <OTPFixture validationType="alphanumeric" defaultValue="12" onValueChange={onValueChange} />);
    await settle();

    const inputs = slotInputs();
    const thirdInput = inputs[2];
    thirdInput.focus();

    compositionStart(thirdInput);
    await inputInto(thirdInput, "a");

    // iOS Safari fires a real `Backspace` keydown while the IME is still composing.
    fire(thirdInput, "keydown", { key: "Backspace" } as KeyboardEventInit);
    await settle();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(thirdInput);
    expect(slotValues()).toEqual(["1", "2", "a", "", "", ""]);

    // The IME deleted its own text, so the composition ends empty and nothing commits.
    await compositionEnd(thirdInput, "");

    expect(onValueChange).not.toHaveBeenCalled();
    expect(slotValues()).toEqual(["1", "2", "", "", "", ""]);
  });

  (["disabled", "readOnly"] as const).forEach((prop) => {
    it(`does not commit a composition that ends after the field becomes ${prop}`, async () => {
      const onValueChange = vi.fn();

      function Test() {
        let flagged: boolean = signal(false);
        return (
          <>
            <OTPField.Root
              length={OTP_LENGTH}
              validationType="alphanumeric"
              onValueChange={onValueChange}
              disabled={prop === "disabled" ? flagged : false}
              readOnly={prop === "readOnly" ? flagged : false}
            >
              {Array.from({ length: OTP_LENGTH }, (_, index) => (
                <OTPField.Input aria-label={index === 0 ? undefined : `Character ${index + 1} of ${OTP_LENGTH}`} />
              ))}
            </OTPField.Root>
            <button data-testid="flag" onClick={() => (flagged = true)}>
              Flag
            </button>
          </>
        );
      }
      const { el } = mount(() => <Test />);
      await settle();

      const inputs = slotInputs();
      const firstInput = inputs[0];
      firstInput.focus();

      compositionStart(firstInput);
      await inputInto(firstInput, "abc");

      fire(el.querySelector('[data-testid="flag"]')!, "click");
      await settle();

      await compositionEnd(firstInput, "abc");

      expect(onValueChange).not.toHaveBeenCalled();
      expect(slotValues()).toEqual(["", "", "", "", "", ""]);
    });
  });
});
