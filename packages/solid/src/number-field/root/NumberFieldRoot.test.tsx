import { fireEvent, render, screen } from "@solidjs/testing-library";
import "@testing-library/jest-dom/vitest";
import { createSignal, flush, OBSERVE } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { createRenderer, describeConformance, nextFrames } from "#test-utils";

import { Field } from "../../field/index";
import { NumberField } from "../index";
import type { NumberFieldRoot } from "./NumberFieldRoot";

function NumberFieldFixture(props: Partial<NumberFieldRoot.Props> = {}) {
  return (
    <NumberField.Root defaultValue={100} {...props}>
      <NumberField.ScrubArea data-testid="scrub-area">
        <NumberField.ScrubAreaCursor />
      </NumberField.ScrubArea>
      <NumberField.Group data-testid="group">
        <NumberField.Decrement data-testid="decrement" />
        <NumberField.Input data-testid="input" aria-label="Amount" />
        <NumberField.Increment data-testid="increment" />
      </NumberField.Group>
    </NumberField.Root>
  );
}

function typeInto(input: HTMLInputElement, text: string) {
  fireEvent.input(input, { target: { value: text } });
  flush();
}

function pressKey(input: HTMLInputElement, key: string, init: Record<string, unknown> = {}) {
  fireEvent.keyDown(input, { key, ...init });
  flush();
}

function createPasteClipboardData(text: string): DataTransfer {
  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", text);
    return dataTransfer;
  } catch {
    // jsdom has no DataTransfer constructor; a plain object works there.
    return { getData: () => text } as unknown as DataTransfer;
  }
}

function pasteInto(input: HTMLElement, text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  // Chromium ignores clipboardData in ClipboardEvent init dicts, so attach it directly.
  Object.defineProperty(event, "clipboardData", { value: createPasteClipboardData(text) });
  input.dispatchEvent(event);
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

describe("<NumberField.Root />", () => {
  const { render: renderWithFlush } = createRenderer();

  describeConformance((props) => <NumberField.Root defaultValue={0} {...props} />, {
    defaultElement: "div",
    as: { targetElement: "span" },
  });

  describe("structure", () => {
    it("renders the group with role=group and the input with number-field semantics", async () => {
      await renderWithFlush(() => <NumberFieldFixture />);

      expect(screen.getByTestId("group")).toHaveAttribute("role", "group");
      const input = screen.getByTestId("input");
      expect(input).toHaveAttribute("type", "text");
      expect(input).toHaveAttribute("aria-roledescription", "Number field");
      expect(screen.getByRole("button", { name: "Increase" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Decrease" })).toBeInTheDocument();
    });

    it("renders a hidden number input for form submission", async () => {
      await renderWithFlush(() => <NumberFieldFixture name="amount" />);

      const hidden = document.querySelector('input[type="number"]') as HTMLInputElement;
      expect(hidden).not.toBeNull();
      expect(hidden).toHaveAttribute("name", "amount");
      expect(hidden).toHaveAttribute("aria-hidden", "true");
      expect(hidden).toHaveAttribute("tabindex", "-1");
      expect(hidden).toHaveValue(100);
    });

    it("shows the formatted default value in the visible input", async () => {
      await renderWithFlush(() => <NumberFieldFixture defaultValue={1234.5} />);
      expect(screen.getByTestId("input")).toHaveValue("1,234.5");
    });
  });

  describe("stepper buttons", () => {
    it("increments and decrements with reasons and commits on click", async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await renderWithFlush(() => <NumberFieldFixture onValueChange={onValueChange} onValueCommitted={onValueCommitted} />);

      fireEvent.click(screen.getByTestId("increment"));
      flush();
      expect(screen.getByTestId("input")).toHaveValue("101");
      expect(onValueChange).toHaveBeenLastCalledWith(101, expect.objectContaining({ reason: "increment-press" }));
      expect(onValueCommitted).toHaveBeenLastCalledWith(101, expect.objectContaining({ reason: "increment-press" }));

      fireEvent.click(screen.getByTestId("decrement"));
      flush();
      expect(screen.getByTestId("input")).toHaveValue("100");
      expect(onValueChange).toHaveBeenLastCalledWith(100, expect.objectContaining({ reason: "decrement-press" }));
    });

    it("seeds an empty field from zero", async () => {
      const onValueChange = vi.fn();
      await renderWithFlush(() => <NumberFieldFixture defaultValue={undefined} onValueChange={onValueChange} />);
      // Empty the field first: no defaultValue means it starts empty.
      expect(screen.getByTestId("input")).toHaveValue("");

      fireEvent.click(screen.getByTestId("increment"));
      flush();
      // An empty field seeds from 0 rather than stepping (0 is then clamped into range).
      expect(screen.getByTestId("input")).toHaveValue("0");
      expect(onValueChange).toHaveBeenLastCalledWith(0, expect.objectContaining({ reason: "increment-press" }));

      fireEvent.click(screen.getByTestId("increment"));
      flush();
      expect(screen.getByTestId("input")).toHaveValue("1");
    });

    it("disables the steppers at the min/max boundaries", async () => {
      await renderWithFlush(() => <NumberFieldFixture defaultValue={10} min={0} max={10} />);

      expect(screen.getByTestId("increment")).toBeDisabled();
      expect(screen.getByTestId("decrement")).not.toBeDisabled();

      fireEvent.click(screen.getByTestId("increment"));
      flush();
      expect(screen.getByTestId("input")).toHaveValue("10");
    });

    it("steps by smallStep with alt and largeStep with shift", async () => {
      const onValueChange = vi.fn();
      await renderWithFlush(() => <NumberFieldFixture onValueChange={onValueChange} />);
      const input = screen.getByTestId("input") as HTMLInputElement;

      pressKey(input, "ArrowUp", { altKey: true });
      expect(input).toHaveValue("100.1");

      pressKey(input, "ArrowUp", { shiftKey: true });
      expect(input).toHaveValue("110.1");
    });

    it("repeats while held and commits once on release", async () => {
      vi.useFakeTimers();
      try {
        const onValueChange = vi.fn();
        const onValueCommitted = vi.fn();
        render(() => <NumberFieldFixture onValueChange={onValueChange} onValueCommitted={onValueCommitted} />);
        flush();

        const increment = screen.getByTestId("increment");
        fireEvent.pointerDown(increment, { button: 0, pointerType: "mouse" });
        flush();
        // First change applies synchronously on pointerdown via dirty-input sync + first tick after the delay.
        vi.advanceTimersByTime(500);
        flush();
        fireEvent.pointerUp(increment);
        flush();

        const input = screen.getByTestId("input") as HTMLInputElement;
        expect(Number(input.value)).toBeGreaterThan(100);
        expect(onValueCommitted).toHaveBeenCalledTimes(1);
        expect(onValueCommitted).toHaveBeenLastCalledWith(Number(input.value), expect.objectContaining({ reason: "increment-press" }));
        expect(onValueChange.mock.calls.length).toBeGreaterThanOrEqual(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("keyboard", () => {
    it("steps with ArrowUp/ArrowDown and commits with the keyboard reason", async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await renderWithFlush(() => <NumberFieldFixture onValueChange={onValueChange} onValueCommitted={onValueCommitted} />);
      const input = screen.getByTestId("input") as HTMLInputElement;

      pressKey(input, "ArrowUp");
      expect(input).toHaveValue("101");
      expect(onValueChange).toHaveBeenLastCalledWith(101, expect.objectContaining({ reason: "keyboard" }));
      expect(onValueCommitted).toHaveBeenLastCalledWith(101, expect.objectContaining({ reason: "keyboard" }));

      pressKey(input, "ArrowDown");
      expect(input).toHaveValue("100");
    });

    it("jumps to min/max with Home/End", async () => {
      await renderWithFlush(() => <NumberFieldFixture min={0} max={50} />);
      const input = screen.getByTestId("input") as HTMLInputElement;

      pressKey(input, "End");
      expect(input).toHaveValue("50");

      pressKey(input, "Home");
      expect(input).toHaveValue("0");
    });

    it("blocks invalid characters while allowing digits and navigation", async () => {
      await renderWithFlush(() => <NumberFieldFixture />);
      const input = screen.getByTestId("input") as HTMLInputElement;

      pressKey(input, "a");
      expect(input).toHaveValue("100");

      pressKey(input, "ArrowLeft");
      expect(input).toHaveValue("100");
    });
  });

  describe("typing and blur", () => {
    it("updates the value live while typing and commits on blur", async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await renderWithFlush(() => <NumberFieldFixture onValueChange={onValueChange} onValueCommitted={onValueCommitted} />);
      const input = screen.getByTestId("input") as HTMLInputElement;

      input.focus();
      typeInto(input, "42");
      expect(onValueChange).toHaveBeenLastCalledWith(42, expect.objectContaining({ reason: "input-change" }));

      input.blur();
      flush();
      expect(input).toHaveValue("42");
      expect(onValueCommitted).toHaveBeenLastCalledWith(42, expect.objectContaining({ reason: "input-blur" }));
    });

    it("clears to null and commits when emptied", async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await renderWithFlush(() => <NumberFieldFixture onValueChange={onValueChange} onValueCommitted={onValueCommitted} />);
      const input = screen.getByTestId("input") as HTMLInputElement;

      input.focus();
      typeInto(input, "");
      expect(onValueChange).toHaveBeenLastCalledWith(null, expect.objectContaining({ reason: "input-clear" }));

      input.blur();
      flush();
      expect(onValueCommitted).toHaveBeenLastCalledWith(null, expect.objectContaining({ reason: "input-clear" }));
    });

    it("keeps partial input visible while it is not yet parseable", async () => {
      const onValueChange = vi.fn();
      await renderWithFlush(() => <NumberFieldFixture onValueChange={onValueChange} />);
      const input = screen.getByTestId("input") as HTMLInputElement;

      input.focus();
      typeInto(input, "-");
      expect(input.value).toBe("-");
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("pastes text at the caret position", async () => {
      await renderWithFlush(() => <NumberFieldFixture defaultValue={123} />);
      const input = screen.getByTestId("input") as HTMLInputElement;
      input.focus();
      input.setSelectionRange(3, 3);

      pasteInto(input, "5");
      flush();
      expect(input.value).toBe("1235");
    });
  });

  describe("controlled mode and clamping", () => {
    it("follows the controlled value", async () => {
      const [value, setValue] = createSignal<number | null>(5);
      await renderWithFlush(() => (
        <NumberField.Root value={value()} onValueChange={setValue}>
          <NumberField.Group>
            <NumberField.Input data-testid="input" />
          </NumberField.Group>
        </NumberField.Root>
      ));

      expect(screen.getByTestId("input")).toHaveValue("5");
      setValue(9);
      flush();
      expect(screen.getByTestId("input")).toHaveValue("9");
    });

    it("clamps step interactions to min/max but allows out-of-range typing when enabled", async () => {
      await renderWithFlush(() => <NumberFieldFixture defaultValue={10} min={0} max={10} allowOutOfRange />);
      const input = screen.getByTestId("input") as HTMLInputElement;

      pressKey(input, "ArrowUp");
      expect(input).toHaveValue("10");

      input.focus();
      typeInto(input, "15");
      expect(input.value).toBe("15");
    });
  });

  describe("disabled and readOnly", () => {
    it("marks data attributes and ignores interaction when disabled", async () => {
      await renderWithFlush(() => <NumberFieldFixture disabled />);
      const root = screen.getByTestId("input").closest("div") as HTMLElement;

      expect(screen.getByTestId("input")).toBeDisabled();
      expect(root).toHaveAttribute("data-disabled");

      fireEvent.click(screen.getByTestId("increment"));
      flush();
      expect(screen.getByTestId("input")).toHaveValue("100");
    });

    it("blocks stepping when readOnly", async () => {
      await renderWithFlush(() => <NumberFieldFixture readOnly />);
      const input = screen.getByTestId("input") as HTMLInputElement;

      pressKey(input, "ArrowUp");
      expect(input).toHaveValue("100");

      // Read-only steppers stay focusable with unavailable semantics (no native disabled).
      const increment = screen.getByTestId("increment");
      expect(increment).toHaveAttribute("aria-disabled", "true");
      expect(increment).toHaveAttribute("data-readonly", "");
      fireEvent.click(increment);
      flush();
      expect(input).toHaveValue("100");
    });
  });

  describe("scrub area", () => {
    it("changes the value by dragging and commits on release", async () => {
      const onValueCommitted = vi.fn();
      await renderWithFlush(() => <NumberFieldFixture onValueCommitted={onValueCommitted} />);
      const input = screen.getByTestId("input") as HTMLInputElement;
      const scrubArea = screen.getByTestId("scrub-area");

      fireEvent.pointerDown(scrubArea, { button: 0, pointerType: "mouse", clientX: 10, clientY: 10 });
      flush();
      fireEvent.pointerMove(window, { movementX: 5, movementY: 0 });
      flush();
      expect(input.value).toBe("105");

      fireEvent.pointerUp(window);
      flush();
      expect(onValueCommitted).toHaveBeenLastCalledWith(105, expect.objectContaining({ reason: "scrub" }));
    });

    it("toggles the scrubbing state while scrubbing", async () => {
      await renderWithFlush(() => <NumberFieldFixture />);
      const root = screen.getByTestId("group").parentElement as HTMLElement;
      const scrubArea = screen.getByTestId("scrub-area");

      expect(root).not.toHaveAttribute("data-scrubbing");
      fireEvent.pointerDown(scrubArea, { button: 0, pointerType: "mouse", clientX: 10, clientY: 10 });
      flush();
      expect(root).toHaveAttribute("data-scrubbing");
      fireEvent.pointerUp(window);
      flush();
      expect(root).not.toHaveAttribute("data-scrubbing");
    });
  });

  describe("field integration", () => {
    it("associates the input with the field label and fills the field", async () => {
      await renderWithFlush(() => (
        <Field.Root>
          <Field.Label data-testid="label">Amount</Field.Label>
          <NumberField.Root defaultValue={7}>
            <NumberField.Group>
              <NumberField.Input data-testid="input" />
            </NumberField.Group>
          </NumberField.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId("input");
      const label = screen.getByTestId("label");
      expect(input.getAttribute("aria-labelledby")).toBe(label.getAttribute("id"));
      expect(input).toHaveValue("7");
    });
  });

  describe("wheel scrub", () => {
    it("steps the value on wheel while focused", async () => {
      const onValueCommitted = vi.fn();
      await renderWithFlush(() => <NumberFieldFixture allowWheelScrub onValueCommitted={onValueCommitted} />);
      const input = screen.getByTestId("input") as HTMLInputElement;
      input.focus();

      fireEvent.wheel(input, { deltaY: -100 });
      flush();
      expect(input).toHaveValue("101");
      expect(onValueCommitted).toHaveBeenLastCalledWith(101, expect.objectContaining({ reason: "wheel" }));
    });
  });

  describe("reactivity diagnostics", () => {
    it("reads no reactive values outside a tracking scope across the interaction paths", async () => {
      const capture = captureStrictReads();
      try {
        await renderWithFlush(() => <NumberFieldFixture allowWheelScrub min={0} max={200} />);
        const input = screen.getByTestId("input") as HTMLInputElement;

        fireEvent.click(screen.getByTestId("increment"));
        flush();
        fireEvent.click(screen.getByTestId("decrement"));
        flush();
        pressKey(input, "ArrowUp");
        pressKey(input, "ArrowDown");
        pressKey(input, "Home");
        pressKey(input, "End");
        input.focus();
        typeInto(input, "42");
        input.blur();
        flush();
        await nextFrames();
        input.focus();
        typeInto(input, "");
        input.blur();
        flush();
        await nextFrames();
        input.focus();
        input.setSelectionRange(2, 2);
        pasteInto(input, "5");
        flush();
        input.blur();
        flush();
        await nextFrames();
        input.focus();
        fireEvent.wheel(input, { deltaY: -100 });
        flush();
        const scrubArea = screen.getByTestId("scrub-area");
        fireEvent.pointerDown(scrubArea, { button: 0, pointerType: "mouse", clientX: 10, clientY: 10 });
        flush();
        fireEvent.pointerMove(window, { movementX: 4, movementY: 0 });
        flush();
        fireEvent.pointerUp(window);
        flush();
        await nextFrames();

        const attribution = (capture.attribution?.events ?? []).map((event) => JSON.stringify(event));
        expect(capture.diagnostics, attribution.length > 0 ? `attribution: ${attribution.join("\n")}` : undefined).toEqual([]);
        expect(attribution).toEqual([]);
      } finally {
        capture.restore();
      }
    });
  });
});
