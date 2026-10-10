import { fireEvent, render, screen } from "@solidjs/testing-library";
import "@testing-library/jest-dom/vitest";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { createRenderer } from "#test-utils";

import { REASONS } from "../../internals/event-details";
import { OTPField } from "../index";
import type { OTPFieldRoot } from "../root/OTPFieldRoot";

const OTP_LENGTH = 6;

function OTPFixture(props: Partial<OTPFieldRoot.Props> = {}) {
  return (
    <OTPField.Root length={OTP_LENGTH} {...props}>
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
  flush();
  await Promise.resolve();
  flush();
}

async function inputInto(input: HTMLInputElement, value: string) {
  fireEvent.input(input, { target: { value } });
  await settle();
}

describe("<OTPField.Input /> IME composition", () => {
  const { render: renderWithFlush } = createRenderer();

  it("commits an IME composition once on compositionend instead of per intermediate change", async () => {
    const onValueChange = vi.fn();

    await renderWithFlush(() => <OTPFixture validationType="alphanumeric" onValueChange={onValueChange} />);

    const inputs = slotInputs();
    const firstInput = inputs[0];
    firstInput.focus();

    fireEvent.compositionStart(firstInput);

    // Safari can surface in-progress IME text through `input` as an accumulating string.
    await inputInto(firstInput, "d");
    await inputInto(firstInput, "dd");
    await inputInto(firstInput, "ddd");

    // No value commits while the composition is active; the text is only buffered for display.
    expect(onValueChange).not.toHaveBeenCalled();
    expect(slotValues()).toEqual(["ddd", "", "", "", "", ""]);

    fireEvent.compositionEnd(firstInput, { target: { value: "ddd" } });
    await settle();

    // The final composed value commits once across three slots, not six.
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith("ddd", expect.anything());
    expect(slotValues()).toEqual(["d", "d", "d", "", "", ""]);
    expect(document.activeElement).toBe(inputs[3]);
  });

  it("reports characters rejected from a committed IME composition", async () => {
    const onValueChange = vi.fn();
    const onValueInvalid = vi.fn();

    await renderWithFlush(() => <OTPFixture onValueChange={onValueChange} onValueInvalid={onValueInvalid} />);

    const inputs = slotInputs();
    const firstInput = inputs[0];
    firstInput.focus();

    fireEvent.compositionStart(firstInput);
    await inputInto(firstInput, "1a");

    expect(onValueInvalid).not.toHaveBeenCalled();

    fireEvent.compositionEnd(firstInput, { target: { value: "1a" } });
    await settle();

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

    await renderWithFlush(() => <OTPFixture validationType="alphanumeric" defaultValue="12" onValueChange={onValueChange} />);

    const inputs = slotInputs();
    const thirdInput = inputs[2];
    thirdInput.focus();

    fireEvent.compositionStart(thirdInput);
    await inputInto(thirdInput, "a");

    // iOS Safari fires a real `Backspace` keydown while the IME is still composing.
    fireEvent.keyDown(thirdInput, { key: "Backspace" });
    await settle();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(thirdInput);
    expect(slotValues()).toEqual(["1", "2", "a", "", "", ""]);

    // The IME deleted its own text, so the composition ends empty and nothing commits.
    fireEvent.compositionEnd(thirdInput, { target: { value: "" } });
    await settle();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(slotValues()).toEqual(["1", "2", "", "", "", ""]);
  });

  (["disabled", "readOnly"] as const).forEach((prop) => {
    it(`does not commit a composition that ends after the field becomes ${prop}`, async () => {
      const onValueChange = vi.fn();
      let setFlagged!: (flagged: boolean) => void;

      render(() => {
        const [flagged, setFlaggedState] = createSignal(false);
        setFlagged = setFlaggedState;
        return (
          <OTPFixture
            validationType="alphanumeric"
            onValueChange={onValueChange}
            disabled={prop === "disabled" ? flagged() : false}
            readOnly={prop === "readOnly" ? flagged() : false}
          />
        );
      });
      await settle();

      const inputs = slotInputs();
      const firstInput = inputs[0];
      firstInput.focus();

      fireEvent.compositionStart(firstInput);
      await inputInto(firstInput, "abc");

      setFlagged(true);
      await settle();

      fireEvent.compositionEnd(firstInput, { target: { value: "abc" } });
      await settle();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(slotValues()).toEqual(["", "", "", "", "", ""]);
    });
  });
});
