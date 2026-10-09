import { fireEvent, render, screen } from "@solidjs/testing-library";
import "@testing-library/jest-dom/vitest";
import { createSignal, flush, OBSERVE } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { createRenderer, describeConformance, nextFrames } from "#test-utils";

import * as Field from "../../field/index.parts";
import { OTPField } from "../index";
import type { OTPFieldRoot } from "./OTPFieldRoot";

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

async function typeInto(input: HTMLInputElement, text: string) {
  fireEvent.input(input, { target: { value: text } });
  await settle();
}

function createPasteClipboardData(text: string): DataTransfer {
  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", text);
    return dataTransfer;
  } catch {
    // jsdom has no DataTransfer constructor; its ClipboardEvent init accepts a plain object.
    return { getData: () => text } as unknown as DataTransfer;
  }
}

async function pasteInto(input: HTMLElement, text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  // Chromium ignores clipboardData in ClipboardEvent init dicts, so attach it directly.
  Object.defineProperty(event, "clipboardData", { value: createPasteClipboardData(text) });
  input.dispatchEvent(event);
  await settle();
}

async function keyDown(input: HTMLElement, key: string) {
  fireEvent.keyDown(input, { key });
  await settle();
}

async function focus(input: HTMLElement) {
  fireEvent.focus(input);
  await settle();
}

function captureStrictReads() {
  const diagnostics: string[] = [];
  const recordDiagnostic = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("STRICT_READ_UNTRACKED")) {
      diagnostics.push(args[0]);
    }
  };
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(recordDiagnostic);
  const errorSpy = vi.spyOn(console, "error").mockImplementation(recordDiagnostic);
  const attribution = OBSERVE?.diagnostics.capture();
  return {
    diagnostics,
    attribution,
    restore() {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      attribution?.stop();
    },
  };
}

describe("<OTPField.Root />", () => {
  const { render: renderWithFlush } = createRenderer();

  describeConformance((props) => <OTPField.Root length={OTP_LENGTH} {...props} />, {
    defaultElement: "div",
    as: { targetElement: "span" },
  });

  describe("value handling", () => {
    it("splits the default value across inputs", async () => {
      await renderWithFlush(() => <OTPFixture defaultValue="12a34b56" />);
      expect(slotValues()).toEqual(["1", "2", "3", "4", "5", "6"]);
    });

    it("clamps an overlong default value to the rendered slot count", async () => {
      await renderWithFlush(() => <OTPFixture defaultValue="12a34b56c7" name="otp" />);

      expect(slotValues()).toEqual(["1", "2", "3", "4", "5", "6"]);
      const inputs = slotInputs();
      expect(inputs[0]).toHaveAttribute("maxlength", "6");
      inputs.slice(1).forEach((input) => {
        expect(input).not.toHaveAttribute("maxlength");
      });

      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');
      expect(hiddenInput).toHaveValue("123456");
    });

    it("updates the rendered value in controlled mode", async () => {
      const [value, setValue] = createSignal("12");
      await renderWithFlush(() => (
        <OTPField.Root length={OTP_LENGTH} value={value()} onValueChange={setValue}>
          {Array.from({ length: OTP_LENGTH }, () => (
            <OTPField.Input />
          ))}
        </OTPField.Root>
      ));

      expect(slotValues()).toEqual(["1", "2", "", "", "", ""]);

      setValue("654321");
      flush();

      expect(slotValues()).toEqual(["6", "5", "4", "3", "2", "1"]);
    });

    it("moves focus to the next slot when typing", async () => {
      await renderWithFlush(() => <OTPFixture />);
      const inputs = slotInputs();

      inputs[0].focus();
      await typeInto(inputs[0], "1");

      expect(slotValues()).toEqual(["1", "", "", "", "", ""]);
      expect(document.activeElement).toBe(inputs[1]);
    });

    it("distributes multiple typed characters across slots", async () => {
      await renderWithFlush(() => <OTPFixture />);
      const inputs = slotInputs();

      inputs[0].focus();
      await typeInto(inputs[0], "123");

      expect(slotValues()).toEqual(["1", "2", "3", "", "", ""]);
      expect(document.activeElement).toBe(inputs[3]);
    });

    it("removes the character and moves focus back on Backspace", async () => {
      await renderWithFlush(() => <OTPFixture defaultValue="12" />);
      const inputs = slotInputs();

      await focus(inputs[1]);
      await keyDown(inputs[1], "Backspace");

      expect(slotValues()).toEqual(["1", "", "", "", "", ""]);
      expect(document.activeElement).toBe(inputs[0]);
    });

    it("removes the previous character when Backspace is pressed on an empty slot", async () => {
      await renderWithFlush(() => <OTPFixture defaultValue="1" />);
      const inputs = slotInputs();

      await focus(inputs[1]);
      await keyDown(inputs[1], "Backspace");

      expect(slotValues()).toEqual(["", "", "", "", "", ""]);
      expect(document.activeElement).toBe(inputs[0]);
    });

    it("removes the character at the slot on Delete", async () => {
      await renderWithFlush(() => <OTPFixture defaultValue="12" />);
      const inputs = slotInputs();

      await keyDown(inputs[0], "Delete");

      expect(slotValues()).toEqual(["2", "", "", "", "", ""]);
    });

    it("clears a slot through text input with the input-clear reason", async () => {
      const onValueChange = vi.fn();
      await renderWithFlush(() => <OTPFixture defaultValue="1" onValueChange={onValueChange} />);
      const inputs = slotInputs();

      await typeInto(inputs[0], "");

      expect(slotValues()).toEqual(["", "", "", "", "", ""]);
      expect(onValueChange).toHaveBeenCalledWith("", expect.objectContaining({ reason: "input-clear" }));
    });

    it("navigates between slots with the arrow keys, Home, and End", async () => {
      await renderWithFlush(() => <OTPFixture defaultValue="123456" />);
      const inputs = slotInputs();

      inputs[2].focus();
      await keyDown(inputs[2], "ArrowLeft");
      expect(document.activeElement).toBe(inputs[1]);

      await keyDown(document.activeElement as HTMLInputElement, "ArrowRight");
      expect(document.activeElement).toBe(inputs[2]);

      await keyDown(document.activeElement as HTMLInputElement, "Home");
      expect(document.activeElement).toBe(inputs[0]);

      await keyDown(document.activeElement as HTMLInputElement, "End");
      expect(document.activeElement).toBe(inputs[5]);
    });

    it("mirrors arrow navigation in rtl direction", async () => {
      await renderWithFlush(() => (
        <div dir="rtl">
          <OTPFixture defaultValue="123456" />
        </div>
      ));
      const inputs = slotInputs();

      inputs[2].focus();
      await keyDown(inputs[2], "ArrowLeft");
      expect(document.activeElement).toBe(inputs[3]);

      await keyDown(document.activeElement as HTMLInputElement, "ArrowRight");
      expect(document.activeElement).toBe(inputs[2]);
    });

    it("distributes pasted text across slots starting at the focused slot", async () => {
      await renderWithFlush(() => <OTPFixture defaultValue="1" />);
      const inputs = slotInputs();

      await pasteInto(inputs[1], "234");

      expect(slotValues()).toEqual(["1", "2", "3", "4", "", ""]);
      expect(document.activeElement).toBe(inputs[4]);
    });

    it("keeps the roving tabindex on the active slot", async () => {
      await renderWithFlush(() => <OTPFixture defaultValue="12" />);
      const inputs = slotInputs();

      expect(inputs.map((input) => input.tabIndex)).toEqual([-1, -1, 0, -1, -1, -1]);

      await focus(inputs[1]);

      expect(inputs.map((input) => input.tabIndex)).toEqual([-1, 0, -1, -1, -1, -1]);
    });
  });

  describe("completion callbacks", () => {
    it("fires onValueComplete with the input-change reason once the last slot is typed", async () => {
      const onValueChange = vi.fn();
      const onValueComplete = vi.fn();
      await renderWithFlush(() => <OTPFixture onValueChange={onValueChange} onValueComplete={onValueComplete} />);
      const inputs = slotInputs();

      inputs[0].focus();
      for (let index = 0; index < OTP_LENGTH; index += 1) {
        await typeInto(inputs[index], `${index + 1}`);
      }

      expect(onValueComplete).toHaveBeenCalledTimes(1);
      expect(onValueComplete).toHaveBeenLastCalledWith("123456", expect.objectContaining({ reason: "input-change" }));
      expect(onValueChange).toHaveBeenLastCalledWith("123456", expect.objectContaining({ reason: "input-change" }));
    });

    it("fires onValueComplete with the input-paste reason when pasting a complete value", async () => {
      const onValueChange = vi.fn();
      const onValueComplete = vi.fn();
      await renderWithFlush(() => <OTPFixture onValueChange={onValueChange} onValueComplete={onValueComplete} />);

      await pasteInto(slotInputs()[0], "123456");

      expect(onValueChange).toHaveBeenCalledWith("123456", expect.objectContaining({ reason: "input-paste" }));
      expect(onValueComplete).toHaveBeenCalledTimes(1);
      expect(onValueComplete).toHaveBeenLastCalledWith("123456", expect.objectContaining({ reason: "input-paste" }));
    });

    it("fires onValueComplete without onValueChange when the same complete value is pasted again", async () => {
      const onValueChange = vi.fn();
      const onValueComplete = vi.fn();
      await renderWithFlush(() => <OTPFixture defaultValue="123456" onValueChange={onValueChange} onValueComplete={onValueComplete} />);

      await pasteInto(slotInputs()[0], "123456");

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueComplete).toHaveBeenCalledTimes(1);
      expect(onValueComplete).toHaveBeenLastCalledWith("123456", expect.objectContaining({ reason: "input-paste" }));
    });

    it("submits the owning form when autoSubmit is set and the value completes", async () => {
      const onValueComplete = vi.fn();
      let submitted = false;
      await renderWithFlush(() => (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitted = true;
          }}
        >
          <OTPFixture autoSubmit onValueComplete={onValueComplete} />
          <button type="submit">Submit</button>
        </form>
      ));

      const form = document.querySelector("form") as HTMLFormElement;
      const requestSubmit = vi.fn();
      form.requestSubmit = requestSubmit;

      await pasteInto(slotInputs()[0], "123456");

      expect(onValueComplete).toHaveBeenCalledTimes(1);
      expect(requestSubmit).toHaveBeenCalledTimes(1);
      expect(submitted).toBe(false);
    });
  });

  describe("validation and normalization", () => {
    it("reports rejected characters through onValueInvalid without changing the value", async () => {
      const onValueInvalid = vi.fn();
      const onValueChange = vi.fn();
      await renderWithFlush(() => <OTPFixture onValueInvalid={onValueInvalid} onValueChange={onValueChange} />);

      await typeInto(slotInputs()[0], "a");

      expect(slotValues()).toEqual(["", "", "", "", "", ""]);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueInvalid).toHaveBeenCalledTimes(1);
      expect(onValueInvalid).toHaveBeenLastCalledWith("a", expect.objectContaining({ reason: "input-change" }));
    });

    it("accepts letters with the alphanumeric validation type", async () => {
      await renderWithFlush(() => <OTPFixture validationType="alphanumeric" />);
      const inputs = slotInputs();

      inputs[0].focus();
      await typeInto(inputs[0], "a");

      expect(slotValues()).toEqual(["a", "", "", "", "", ""]);
    });

    it("applies normalizeValue before updating the value", async () => {
      await renderWithFlush(() => <OTPFixture validationType="alphanumeric" normalizeValue={(value) => value.toUpperCase()} />);
      const inputs = slotInputs();

      inputs[0].focus();
      await typeInto(inputs[0], "a");

      expect(slotValues()).toEqual(["A", "", "", "", "", ""]);
    });

    it("renders the hidden validation input with length constraints and pattern", async () => {
      await renderWithFlush(() => <OTPFixture defaultValue="123" name="otp" />);

      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');
      expect(hiddenInput).not.toBeNull();
      expect(hiddenInput).toHaveValue("123");
      expect(hiddenInput).toHaveAttribute("minlength", "6");
      expect(hiddenInput).toHaveAttribute("maxlength", "6");
      expect(hiddenInput).toHaveAttribute("pattern", "\\d{6}");
      expect(hiddenInput).toHaveAttribute("aria-hidden", "true");
      expect(hiddenInput).toHaveAttribute("tabindex", "-1");
    });

    it("exposes slot inputmode, autocomplete, and enterkeyhint hints", async () => {
      await renderWithFlush(() => <OTPFixture />);
      const inputs = slotInputs();

      expect(inputs[0]).toHaveAttribute("inputmode", "numeric");
      expect(inputs[0]).toHaveAttribute("autocomplete", "one-time-code");
      expect(inputs[1]).toHaveAttribute("autocomplete", "off");
      expect(inputs[OTP_LENGTH - 1]).toHaveAttribute("enterkeyhint", "done");
      expect(inputs[0]).toHaveAttribute("enterkeyhint", "next");
    });

    it("masks entered characters when the mask prop is set", async () => {
      await renderWithFlush(() => <OTPFixture mask defaultValue="1" />);
      const inputs = slotInputs();

      inputs.forEach((input) => {
        expect(input).toHaveAttribute("type", "password");
      });
      expect(inputs[0]).toHaveValue("1");
    });

    it("ignores user interaction when disabled or readOnly", async () => {
      const onValueChange = vi.fn();
      await renderWithFlush(() => <OTPFixture disabled name="otp" onValueChange={onValueChange} />);
      const disabledInputs = slotInputs();

      expect(disabledInputs[0]).toBeDisabled();
      // Solid's delegated listeners skip disabled nodes, matching browser
      // behavior where disabled inputs receive no input events at all.
      fireEvent.keyDown(disabledInputs[0], { key: "1" });
      flush();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(document.querySelector<HTMLInputElement>('input[name="otp"]')).toHaveValue("");
    });

    it("ignores user interaction when readOnly", async () => {
      const onValueChange = vi.fn();
      await renderWithFlush(() => <OTPFixture readOnly onValueChange={onValueChange} />);
      await typeInto(slotInputs()[0], "1");
      expect(slotValues()).toEqual(["", "", "", "", "", ""]);
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe("state attributes and ids", () => {
    it("marks the root complete and filled as slots fill up", async () => {
      await renderWithFlush(() => <OTPFixture />);
      const root = screen.getByRole("group");

      expect(root).not.toHaveAttribute("data-complete");
      expect(root).not.toHaveAttribute("data-filled");

      await typeInto(slotInputs()[0], "1");
      expect(root).not.toHaveAttribute("data-complete");
      expect(root).toHaveAttribute("data-filled");

      await pasteInto(slotInputs()[1], "23456");
      expect(root).toHaveAttribute("data-complete");
    });

    it("derives slot ids from the root id", async () => {
      await renderWithFlush(() => <OTPFixture id="verification-code" />);
      const inputs = slotInputs();

      expect(inputs[0]).toHaveAttribute("id", "verification-code");
      expect(inputs[1]).toHaveAttribute("id", "verification-code-2");
      expect(inputs[5]).toHaveAttribute("id", "verification-code-6");
    });

    it("marks the filled slot with data-filled", async () => {
      await renderWithFlush(() => <OTPFixture defaultValue="1" />);
      const inputs = slotInputs();

      expect(inputs[0]).toHaveAttribute("data-filled");
      expect(inputs[1]).not.toHaveAttribute("data-filled");
    });

    it("renders grouped layouts with a separator without affecting slot counting", async () => {
      await renderWithFlush(() => (
        <OTPField.Root defaultValue="123456" length={OTP_LENGTH}>
          <div data-testid="first-group">
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
          </div>
          <OTPField.Separator>-</OTPField.Separator>
          <div data-testid="second-group">
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
          </div>
        </OTPField.Root>
      ));

      const root = screen.getByRole("group");
      expect(root).toContainElement(screen.getByTestId("first-group"));
      expect(root).toContainElement(screen.getByTestId("second-group"));
      expect(screen.getByText("-")).toBeVisible();
      expect(slotValues()).toEqual(["1", "2", "3", "4", "5", "6"]);
    });
  });

  describe("field integration", () => {
    it("associates the field label with the first input and submits under the field name", async () => {
      await renderWithFlush(() => (
        <Field.Root name="verificationCode">
          <Field.Label>Verification code</Field.Label>
          <OTPFixture />
        </Field.Root>
      ));

      const label = screen.getByText("Verification code");
      const firstInput = slotInputs()[0];
      expect(label.getAttribute("id")).not.toBeNull();
      expect(firstInput.getAttribute("aria-labelledby")).toBe(label.getAttribute("id"));

      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="verificationCode"]');
      expect(hiddenInput).not.toBeNull();
    });

    it("throws when inputs are rendered outside a root", () => {
      expect(() => render(() => <OTPField.Input />)).toThrow(
        "Rebase UI: OTPFieldRootContext is missing. OTPField parts must be placed within <OTPField.Root>.",
      );
    });
  });

  describe("reactivity diagnostics", () => {
    it("reads no reactive values outside a tracking scope across the interaction paths", async () => {
      const capture = captureStrictReads();
      try {
        await renderWithFlush(() => <OTPFixture />);
        const inputs = slotInputs();

        inputs[0].focus();
        await typeInto(inputs[0], "12");
        await keyDown(inputs[1], "ArrowLeft");
        await keyDown(inputs[0], "ArrowRight");
        await keyDown(inputs[1], "Backspace");
        await pasteInto(inputs[0], "123456");
        await nextFrames();
        await typeInto(inputs[5], "");
        await nextFrames();
        (inputs[0] as HTMLInputElement).blur();
        await settle();

        const attribution = (capture.attribution?.events ?? []).map((event) => JSON.stringify(event));
        expect(capture.diagnostics, attribution.length > 0 ? `attribution: ${attribution.join("\n")}` : undefined).toEqual([]);
        expect(attribution).toEqual([]);
      } finally {
        capture.restore();
      }
    });
  });
});
