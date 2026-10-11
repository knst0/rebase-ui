import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Field from "../../field/index.parts";
import { OTPField } from "../index";
import type { OTPFieldRoot } from "./OTPFieldRoot";

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

async function typeInto(input: HTMLInputElement, text: string) {
  input.value = text;
  fire(input, "input");
  await settle();
}

function createPasteClipboardData(text: string): DataTransfer {
  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", text);
    return dataTransfer;
  } catch {
    // happy-dom has no DataTransfer constructor; a plain object works there.
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
  fire(input, "keydown", { key } as KeyboardEventInit);
  await settle();
}

async function focus(input: HTMLElement) {
  fire(input, "focus");
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
  return {
    diagnostics,
    restore() {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    },
  };
}

describe("<OTPField.Root />", () => {
  describe("component API", () => {
    it("renders a div with group semantics by default", () => {
      const { el } = mount(() => <OTPFixture />);

      const root = screen.getByRole("group");
      expect(el.contains(root)).toBe(true);
      expect(root.tagName).toBe("DIV");
    });

    it("renders the customized root element", () => {
      mount(() => (
        <OTPField.Root length={OTP_LENGTH} as="span">
          <OTPField.Input />
        </OTPField.Root>
      ));

      expect(screen.getByRole("group").tagName).toBe("SPAN");
    });

    it("applies the class when passed as a string", () => {
      mount(() => <OTPFixture class="test-class" />);

      expect(screen.getByRole("group").classList.contains("test-class")).toBe(true);
    });

    it("calls the class function with the component state", () => {
      let stateArgument: unknown;
      mount(() => (
        <OTPFixture
          class={(state) => {
            stateArgument = state;
            return "";
          }}
        />
      ));

      expect(screen.getByRole("group")).toBeTruthy();
      expect(stateArgument).toEqual({
        disabled: false,
        touched: false,
        dirty: false,
        valid: null,
        filled: false,
        focused: false,
        validating: false,
        complete: false,
        length: OTP_LENGTH,
        readOnly: false,
        required: false,
        value: "",
      });
    });

    it("forwards custom props to the root element", () => {
      mount(() => <OTPFixture lang="fr" data-foobar="test-value" />);

      const root = screen.getByRole("group");
      expect(root.getAttribute("lang")).toBe("fr");
      expect(root.getAttribute("data-foobar")).toBe("test-value");
    });

    it("forwards the style prop", () => {
      mount(() => <OTPFixture style={{ color: "green" }} />);

      expect((screen.getByRole("group") as HTMLElement).style.color).toBe("green");
    });

    it("renders children defined as a function of state", () => {
      mount(() => (
        <OTPField.Root length={OTP_LENGTH} defaultValue="12">
          {(state) => <span data-testid="state">{state.value}</span>}
        </OTPField.Root>
      ));

      expect(screen.getByTestId("state").textContent).toBe("12");
    });

    it("attaches the ref to the root element", () => {
      let instance: HTMLElement | null = null;
      mount(() => (
        <OTPFixture
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        />
      ));

      expect(instance).toBe(screen.getByRole("group"));
    });
  });

  describe("value handling", () => {
    it("splits the default value across inputs", async () => {
      mount(() => <OTPFixture defaultValue="12a34b56" />);
      await settle();
      expect(slotValues()).toEqual(["1", "2", "3", "4", "5", "6"]);
    });

    it("clamps an overlong default value to the rendered slot count", async () => {
      mount(() => <OTPFixture defaultValue="12a34b56c7" name="otp" />);
      await settle();

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
      function Test() {
        let value: string = signal("12");
        return (
          <>
            <OTPField.Root length={OTP_LENGTH} value={value} onValueChange={(next) => (value = next)}>
              {Array.from({ length: OTP_LENGTH }, () => (
                <OTPField.Input />
              ))}
            </OTPField.Root>
            <button data-testid="set" onClick={() => (value = "654321")}>
              Set
            </button>
          </>
        );
      }
      const { el } = mount(() => <Test />);
      await settle();

      expect(slotValues()).toEqual(["1", "2", "", "", "", ""]);

      fire(el.querySelector('[data-testid="set"]')!, "click");
      await settle();

      expect(slotValues()).toEqual(["6", "5", "4", "3", "2", "1"]);
    });

    it("moves focus to the next slot when typing", async () => {
      mount(() => <OTPFixture />);
      await settle();
      const inputs = slotInputs();

      inputs[0].focus();
      await typeInto(inputs[0], "1");

      expect(slotValues()).toEqual(["1", "", "", "", "", ""]);
      expect(document.activeElement).toBe(inputs[1]);
    });

    it("distributes multiple typed characters across slots", async () => {
      mount(() => <OTPFixture />);
      await settle();
      const inputs = slotInputs();

      inputs[0].focus();
      await typeInto(inputs[0], "123");

      expect(slotValues()).toEqual(["1", "2", "3", "", "", ""]);
      expect(document.activeElement).toBe(inputs[3]);
    });

    it("removes the character and moves focus back on Backspace", async () => {
      mount(() => <OTPFixture defaultValue="12" />);
      await settle();
      const inputs = slotInputs();

      await focus(inputs[1]);
      await keyDown(inputs[1], "Backspace");

      expect(slotValues()).toEqual(["1", "", "", "", "", ""]);
      expect(document.activeElement).toBe(inputs[0]);
    });

    it("removes the previous character when Backspace is pressed on an empty slot", async () => {
      mount(() => <OTPFixture defaultValue="1" />);
      await settle();
      const inputs = slotInputs();

      await focus(inputs[1]);
      await keyDown(inputs[1], "Backspace");

      expect(slotValues()).toEqual(["", "", "", "", "", ""]);
      expect(document.activeElement).toBe(inputs[0]);
    });

    it("removes the character at the slot on Delete", async () => {
      mount(() => <OTPFixture defaultValue="12" />);
      await settle();
      const inputs = slotInputs();

      await keyDown(inputs[0], "Delete");

      expect(slotValues()).toEqual(["2", "", "", "", "", ""]);
    });

    it("clears a slot through text input with the input-clear reason", async () => {
      const onValueChange = vi.fn();
      mount(() => <OTPFixture defaultValue="1" onValueChange={onValueChange} />);
      await settle();
      const inputs = slotInputs();

      await typeInto(inputs[0], "");

      expect(slotValues()).toEqual(["", "", "", "", "", ""]);
      expect(onValueChange).toHaveBeenCalledWith("", expect.objectContaining({ reason: "input-clear" }));
    });

    it("navigates between slots with the arrow keys, Home, and End", async () => {
      mount(() => <OTPFixture defaultValue="123456" />);
      await settle();
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
      const { el } = mount(() => <OTPFixture defaultValue="123456" />);
      el.setAttribute("dir", "rtl");
      await settle();
      const inputs = slotInputs();

      inputs[2].focus();
      await keyDown(inputs[2], "ArrowLeft");
      expect(document.activeElement).toBe(inputs[3]);

      await keyDown(document.activeElement as HTMLInputElement, "ArrowRight");
      expect(document.activeElement).toBe(inputs[2]);
    });

    it("distributes pasted text across slots starting at the focused slot", async () => {
      mount(() => <OTPFixture defaultValue="1" />);
      await settle();
      const inputs = slotInputs();

      await pasteInto(inputs[1], "234");

      expect(slotValues()).toEqual(["1", "2", "3", "4", "", ""]);
      expect(document.activeElement).toBe(inputs[4]);
    });

    it("keeps the roving tabindex on the active slot", async () => {
      mount(() => <OTPFixture defaultValue="12" />);
      await settle();
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
      mount(() => <OTPFixture onValueChange={onValueChange} onValueComplete={onValueComplete} />);
      await settle();
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
      mount(() => <OTPFixture onValueChange={onValueChange} onValueComplete={onValueComplete} />);
      await settle();

      await pasteInto(slotInputs()[0], "123456");

      expect(onValueChange).toHaveBeenCalledWith("123456", expect.objectContaining({ reason: "input-paste" }));
      expect(onValueComplete).toHaveBeenCalledTimes(1);
      expect(onValueComplete).toHaveBeenLastCalledWith("123456", expect.objectContaining({ reason: "input-paste" }));
    });

    it("fires onValueComplete without onValueChange when the same complete value is pasted again", async () => {
      const onValueChange = vi.fn();
      const onValueComplete = vi.fn();
      mount(() => <OTPFixture defaultValue="123456" onValueChange={onValueChange} onValueComplete={onValueComplete} />);
      await settle();

      await pasteInto(slotInputs()[0], "123456");

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueComplete).toHaveBeenCalledTimes(1);
      expect(onValueComplete).toHaveBeenLastCalledWith("123456", expect.objectContaining({ reason: "input-paste" }));
    });

    it("submits the owning form when autoSubmit is set and the value completes", async () => {
      const onValueComplete = vi.fn();
      let submitted = false;
      mount(() => (
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
      await settle();

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
      mount(() => <OTPFixture onValueInvalid={onValueInvalid} onValueChange={onValueChange} />);
      await settle();

      await typeInto(slotInputs()[0], "a");

      expect(slotValues()).toEqual(["", "", "", "", "", ""]);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueInvalid).toHaveBeenCalledTimes(1);
      expect(onValueInvalid).toHaveBeenLastCalledWith("a", expect.objectContaining({ reason: "input-change" }));
    });

    it("accepts letters with the alphanumeric validation type", async () => {
      mount(() => <OTPFixture validationType="alphanumeric" />);
      await settle();
      const inputs = slotInputs();

      inputs[0].focus();
      await typeInto(inputs[0], "a");

      expect(slotValues()).toEqual(["a", "", "", "", "", ""]);
    });

    it("applies normalizeValue before updating the value", async () => {
      mount(() => <OTPFixture validationType="alphanumeric" normalizeValue={(value) => value.toUpperCase()} />);
      await settle();
      const inputs = slotInputs();

      inputs[0].focus();
      await typeInto(inputs[0], "a");

      expect(slotValues()).toEqual(["A", "", "", "", "", ""]);
    });

    it("renders the hidden validation input with length constraints and pattern", async () => {
      mount(() => <OTPFixture defaultValue="123" name="otp" />);
      await settle();

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
      mount(() => <OTPFixture />);
      await settle();
      const inputs = slotInputs();

      expect(inputs[0]).toHaveAttribute("inputmode", "numeric");
      expect(inputs[0]).toHaveAttribute("autocomplete", "one-time-code");
      expect(inputs[1]).toHaveAttribute("autocomplete", "off");
      expect(inputs[OTP_LENGTH - 1]).toHaveAttribute("enterkeyhint", "done");
      expect(inputs[0]).toHaveAttribute("enterkeyhint", "next");
    });

    it("masks entered characters when the mask prop is set", async () => {
      mount(() => <OTPFixture mask defaultValue="1" />);
      await settle();
      const inputs = slotInputs();

      inputs.forEach((input) => {
        expect(input).toHaveAttribute("type", "password");
      });
      expect(inputs[0]).toHaveValue("1");
    });

    it("ignores user interaction when disabled or readOnly", async () => {
      const onValueChange = vi.fn();
      mount(() => <OTPFixture disabled name="otp" onValueChange={onValueChange} />);
      await settle();
      const disabledInputs = slotInputs();

      expect(disabledInputs[0]).toBeDisabled();
      fire(disabledInputs[0], "keydown", { key: "1" } as KeyboardEventInit);
      await settle();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(document.querySelector<HTMLInputElement>('input[name="otp"]')).toHaveValue("");
    });

    it("ignores user interaction when readOnly", async () => {
      const onValueChange = vi.fn();
      mount(() => <OTPFixture readOnly onValueChange={onValueChange} />);
      await settle();
      await typeInto(slotInputs()[0], "1");
      expect(slotValues()).toEqual(["", "", "", "", "", ""]);
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe("state attributes and ids", () => {
    it("marks the root complete and filled as slots fill up", async () => {
      mount(() => <OTPFixture />);
      await settle();
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
      mount(() => <OTPFixture id="verification-code" />);
      await settle();
      const inputs = slotInputs();

      expect(inputs[0]).toHaveAttribute("id", "verification-code");
      expect(inputs[1]).toHaveAttribute("id", "verification-code-2");
      expect(inputs[5]).toHaveAttribute("id", "verification-code-6");
    });

    it("marks the filled slot with data-filled", async () => {
      mount(() => <OTPFixture defaultValue="1" />);
      await settle();
      const inputs = slotInputs();

      expect(inputs[0]).toHaveAttribute("data-filled");
      expect(inputs[1]).not.toHaveAttribute("data-filled");
    });

    it("renders grouped layouts with a separator without affecting slot counting", async () => {
      mount(() => (
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
      await settle();

      const root = screen.getByRole("group");
      expect(root).toContainElement(screen.getByTestId("first-group"));
      expect(root).toContainElement(screen.getByTestId("second-group"));
      expect(screen.getByText("-")).toBeVisible();
      expect(slotValues()).toEqual(["1", "2", "3", "4", "5", "6"]);
    });
  });

  describe("field integration", () => {
    it("associates the field label with the first input and submits under the field name", async () => {
      mount(() => (
        <Field.Root name="verificationCode">
          <Field.Label>Verification code</Field.Label>
          <OTPFixture />
        </Field.Root>
      ));
      await settle();

      const label = screen.getByText("Verification code");
      const firstInput = slotInputs()[0];
      expect(label.getAttribute("id")).not.toBeNull();
      expect(firstInput.getAttribute("aria-labelledby")).toBe(label.getAttribute("id"));

      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="verificationCode"]');
      expect(hiddenInput).not.toBeNull();
    });

    it("throws when inputs are rendered outside a root", () => {
      expect(() => mount(() => <OTPField.Input />)).toThrow(
        "Rebase UI: OTPFieldRootContext is missing. OTPField parts must be placed within <OTPField.Root>.",
      );
    });
  });

  describe("reactivity diagnostics", () => {
    it("reads no reactive values outside a tracking scope across the interaction paths", async () => {
      const capture = captureStrictReads();
      try {
        mount(() => <OTPFixture />);
        await settle();
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

        expect(capture.diagnostics).toEqual([]);
      } finally {
        capture.restore();
      }
    });
  });
});
