import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as Field from "../../field/index.parts";
import * as NumberField from "../index.parts";
import type { NumberFieldRoot } from "./NumberFieldRoot";

afterEach(cleanup);

function getByTestId(root: ParentNode, testId: string): HTMLElement {
  const found = root.querySelector(`[data-testid="${testId}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error(`element with data-testid="${testId}" not found`);
  }
  return found;
}

function NumberFieldFixture(props: Partial<NumberFieldRoot.Props> = {}) {
  return (
    <NumberField.Root defaultValue={100} {...(props as NumberFieldRoot.Props)}>
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
  input.value = text;
  fire(input, "input");
  tick();
}

function pressKey(input: HTMLInputElement, key: string, init: KeyboardEventInit = {}) {
  fire(input, "keydown", { key, ...init } as KeyboardEventInit);
  tick();
}

function pointerEvent(type: string, init: Record<string, unknown> = {}): Event {
  // `fire` builds a plain Event for pointer types and drops custom init, so dispatch manually.
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, init);
  return event;
}

function wheelEvent(init: Record<string, unknown>): Event {
  const event = new Event("wheel", { bubbles: true, cancelable: true });
  Object.assign(event, init);
  return event;
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

function pasteInto(input: HTMLElement, text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  // Chromium ignores clipboardData in ClipboardEvent init dicts, so attach it directly.
  Object.defineProperty(event, "clipboardData", { value: createPasteClipboardData(text) });
  input.dispatchEvent(event);
}

describe("<NumberField.Root />", () => {
  it("renders a div with the group, input, and stepper semantics by default", () => {
    const { el } = mount(() => <NumberFieldFixture />);

    const root = getByTestId(el, "group").parentElement as HTMLElement;
    expect(root.tagName).toBe("DIV");
    expect(getByTestId(el, "group")).toHaveAttribute("role", "group");
    const input = getByTestId(el, "input");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("aria-roledescription", "Number field");
    expect(el.querySelector('[aria-label="Increase"]')).toBeInTheDocument();
    expect(el.querySelector('[aria-label="Decrease"]')).toBeInTheDocument();
  });

  it("renders the customized root element", () => {
    const { el } = mount(() => (
      <NumberField.Root defaultValue={0} data-testid="root" as="span">
        <NumberField.Input data-testid="input" />
      </NumberField.Root>
    ));

    expect(getByTestId(el, "root").tagName).toBe("SPAN");
  });

  it("calls the class function with the component state", () => {
    let stateArgument: unknown;
    const { el } = mount(() => (
      <NumberField.Root
        defaultValue={5}
        data-testid="root"
        class={(state) => {
          stateArgument = state;
          return "";
        }}
      >
        <NumberField.Input data-testid="input" />
      </NumberField.Root>
    ));

    expect(getByTestId(el, "root")).toBeTruthy();
    expect(stateArgument).toEqual(
      expect.objectContaining({ value: 5, inputValue: "5", required: false, readOnly: false, scrubbing: false, disabled: false }),
    );
  });

  it("renders children defined as a function of state", () => {
    const { el } = mount(() => (
      <NumberField.Root defaultValue={5} data-testid="root">
        {(state) => <span data-testid="stateful">{state.value}</span>}
      </NumberField.Root>
    ));

    expect(getByTestId(el, "stateful").textContent).toBe("5");
  });

  it("attaches a callback ref to the root element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <NumberField.Root
        defaultValue={0}
        data-testid="root"
        ref={(value: HTMLElement) => {
          instance = value;
        }}
      >
        <NumberField.Input data-testid="input" />
      </NumberField.Root>
    ));

    expect(instance).toBe(getByTestId(el, "root"));
  });

  it("preserves an explicit accessible label over the enclosing field label", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Label>Fallback label</Field.Label>
        <span id="explicit-number-label">Invoice quantity</span>
        <NumberField.Root defaultValue={1}>
          <NumberField.Input data-testid="input" aria-labelledby="explicit-number-label" />
        </NumberField.Root>
      </Field.Root>
    ));

    const input = getByTestId(el, "input") as HTMLInputElement;
    expect(input.getAttribute("aria-labelledby")).toBe("explicit-number-label");
    expect(el.querySelector("#explicit-number-label")?.textContent).toBe("Invoice quantity");
    expect(input).toHaveValue("1");
  });

  describe("structure", () => {
    it("renders a hidden number input for form submission", () => {
      const { el } = mount(() => <NumberFieldFixture name="amount" />);

      const hidden = el.querySelector('input[type="number"]') as HTMLInputElement;
      expect(hidden).not.toBeNull();
      expect(hidden).toHaveAttribute("name", "amount");
      expect(hidden).toHaveAttribute("aria-hidden", "true");
      expect(hidden).toHaveAttribute("tabindex", "-1");
      expect(hidden).toHaveValue(100);
    });

    it("shows the formatted default value in the visible input", () => {
      const { el } = mount(() => <NumberFieldFixture defaultValue={1234.5} />);
      expect(getByTestId(el, "input")).toHaveValue("1,234.5");
    });
  });

  describe("stepper buttons", () => {
    it("increments and decrements with reasons and commits on click", () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      const { el } = mount(() => <NumberFieldFixture onValueChange={onValueChange} onValueCommitted={onValueCommitted} />);

      fire(getByTestId(el, "increment"), "click");
      tick();
      expect(getByTestId(el, "input")).toHaveValue("101");
      expect(onValueChange).toHaveBeenLastCalledWith(101, expect.objectContaining({ reason: "increment-press" }));
      expect(onValueCommitted).toHaveBeenLastCalledWith(101, expect.objectContaining({ reason: "increment-press" }));

      fire(getByTestId(el, "decrement"), "click");
      tick();
      expect(getByTestId(el, "input")).toHaveValue("100");
      expect(onValueChange).toHaveBeenLastCalledWith(100, expect.objectContaining({ reason: "decrement-press" }));
    });

    it("seeds an empty field from zero", () => {
      const onValueChange = vi.fn();
      const { el } = mount(() => (
        <NumberField.Root defaultValue={undefined} onValueChange={onValueChange}>
          <NumberField.Group data-testid="group">
            <NumberField.Decrement data-testid="decrement" />
            <NumberField.Input data-testid="input" aria-label="Amount" />
            <NumberField.Increment data-testid="increment" />
          </NumberField.Group>
        </NumberField.Root>
      ));
      // Empty the field first: no defaultValue means it starts empty.
      expect(getByTestId(el, "input")).toHaveValue("");

      fire(getByTestId(el, "increment"), "click");
      tick();
      // An empty field seeds from 0 rather than stepping (0 is then clamped into range).
      expect(getByTestId(el, "input")).toHaveValue("0");
      expect(onValueChange).toHaveBeenLastCalledWith(0, expect.objectContaining({ reason: "increment-press" }));

      fire(getByTestId(el, "increment"), "click");
      tick();
      expect(getByTestId(el, "input")).toHaveValue("1");
    });

    it("disables the steppers at the min/max boundaries", () => {
      const { el } = mount(() => <NumberFieldFixture defaultValue={10} min={0} max={10} />);

      expect(getByTestId(el, "increment")).toBeDisabled();
      expect(getByTestId(el, "decrement")).not.toBeDisabled();

      fire(getByTestId(el, "increment"), "click");
      tick();
      expect(getByTestId(el, "input")).toHaveValue("10");
    });

    it("steps by smallStep with alt and largeStep with shift", () => {
      const onValueChange = vi.fn();
      const { el } = mount(() => <NumberFieldFixture onValueChange={onValueChange} />);
      const input = getByTestId(el, "input") as HTMLInputElement;

      pressKey(input, "ArrowUp", { altKey: true });
      expect(input).toHaveValue("100.1");

      pressKey(input, "ArrowUp", { shiftKey: true });
      expect(input).toHaveValue("110.1");
    });

    it("repeats while held and commits once on release", () => {
      vi.useFakeTimers();
      try {
        const onValueChange = vi.fn();
        const onValueCommitted = vi.fn();
        const { el } = mount(() => <NumberFieldFixture onValueChange={onValueChange} onValueCommitted={onValueCommitted} />);
        tick();

        const increment = getByTestId(el, "increment");
        increment.dispatchEvent(pointerEvent("pointerdown", { button: 0, pointerType: "mouse" }));
        tick();
        // First change applies synchronously on pointerdown via dirty-input sync + first tick after the delay.
        vi.advanceTimersByTime(500);
        tick();
        increment.dispatchEvent(pointerEvent("pointerup"));
        tick();

        const input = getByTestId(el, "input") as HTMLInputElement;
        expect(Number(input.value)).toBeGreaterThan(100);
        expect(onValueCommitted).toHaveBeenCalledTimes(1);
        expect(onValueCommitted).toHaveBeenLastCalledWith(Number(input.value), expect.objectContaining({ reason: "increment-press" }));
        expect(onValueChange.mock.calls.length).toBeGreaterThanOrEqual(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("stops repeating when disabled mid-hold and suppresses the trailing click", () => {
      vi.useFakeTimers();
      try {
        const onValueChange = vi.fn();
        const onValueCommitted = vi.fn();
        function Test() {
          let disabled = signal(false);
          return (
            <NumberField.Root defaultValue={100} disabled={disabled} onValueChange={onValueChange} onValueCommitted={onValueCommitted}>
              <NumberField.Group>
                <NumberField.Increment data-testid="increment" />
                <NumberField.Input data-testid="input" aria-label="Amount" />
              </NumberField.Group>
              <button data-testid="toggle" onClick={() => (disabled = !disabled)}>
                Toggle
              </button>
            </NumberField.Root>
          );
        }
        const { el } = mount(() => <Test />);
        tick();

        const increment = getByTestId(el, "increment");
        const input = getByTestId(el, "input") as HTMLInputElement;

        increment.dispatchEvent(pointerEvent("pointerdown", { button: 0, pointerType: "mouse" }));
        tick();
        vi.advanceTimersByTime(450);
        tick();
        expect(input).toHaveValue("101");

        fire(getByTestId(el, "toggle"), "click");
        tick();
        vi.advanceTimersByTime(1000);
        tick();
        expect(input).toHaveValue("101");
        expect(onValueChange).toHaveBeenCalledTimes(1);

        // The canceled press releases without committing.
        increment.dispatchEvent(pointerEvent("pointerup"));
        tick();
        expect(onValueCommitted).not.toHaveBeenCalled();

        fire(getByTestId(el, "toggle"), "click");
        tick();
        // The trailing click of the canceled press is suppressed...
        fire(increment, "click");
        tick();
        expect(input).toHaveValue("101");
        expect(onValueCommitted).not.toHaveBeenCalled();
        // ...but the next fresh click steps again.
        fire(increment, "click");
        tick();
        expect(input).toHaveValue("102");
      } finally {
        vi.useRealTimers();
      }
    });

    it("stops repeating at the max boundary", () => {
      vi.useFakeTimers();
      try {
        const onValueChange = vi.fn();
        const { el } = mount(() => (
          <NumberField.Root defaultValue={100} max={102} onValueChange={onValueChange}>
            <NumberField.Group>
              <NumberField.Increment data-testid="increment" />
              <NumberField.Input data-testid="input" aria-label="Amount" />
            </NumberField.Group>
          </NumberField.Root>
        ));
        tick();

        const increment = getByTestId(el, "increment");
        const input = getByTestId(el, "input") as HTMLInputElement;

        increment.dispatchEvent(pointerEvent("pointerdown", { button: 0, pointerType: "mouse" }));
        tick();
        vi.advanceTimersByTime(2000);
        tick();
        expect(input).toHaveValue("102");
        expect(onValueChange).toHaveBeenCalledTimes(2);
        expect(onValueChange).toHaveBeenLastCalledWith(102, expect.objectContaining({ reason: "increment-press" }));

        // The spent ticks produce no further changes once the boundary is reached.
        vi.advanceTimersByTime(2000);
        tick();
        expect(input).toHaveValue("102");
        expect(onValueChange).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("keyboard", () => {
    it("steps with ArrowUp/ArrowDown and commits with the keyboard reason", () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      const { el } = mount(() => <NumberFieldFixture onValueChange={onValueChange} onValueCommitted={onValueCommitted} />);
      const input = getByTestId(el, "input") as HTMLInputElement;

      pressKey(input, "ArrowUp");
      expect(input).toHaveValue("101");
      expect(onValueChange).toHaveBeenLastCalledWith(101, expect.objectContaining({ reason: "keyboard" }));
      expect(onValueCommitted).toHaveBeenLastCalledWith(101, expect.objectContaining({ reason: "keyboard" }));

      pressKey(input, "ArrowDown");
      expect(input).toHaveValue("100");
    });

    it("jumps to min/max with Home/End", () => {
      const { el } = mount(() => <NumberFieldFixture min={0} max={50} />);
      const input = getByTestId(el, "input") as HTMLInputElement;

      pressKey(input, "End");
      expect(input).toHaveValue("50");

      pressKey(input, "Home");
      expect(input).toHaveValue("0");
    });

    it("blocks invalid characters while allowing digits and navigation", () => {
      const { el } = mount(() => <NumberFieldFixture />);
      const input = getByTestId(el, "input") as HTMLInputElement;

      pressKey(input, "a");
      expect(input).toHaveValue("100");

      pressKey(input, "ArrowLeft");
      expect(input).toHaveValue("100");
    });
  });

  describe("typing and blur", () => {
    it("updates the value live while typing and commits on blur", () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      const { el } = mount(() => <NumberFieldFixture onValueChange={onValueChange} onValueCommitted={onValueCommitted} />);
      const input = getByTestId(el, "input") as HTMLInputElement;

      input.focus();
      tick();
      typeInto(input, "42");
      expect(onValueChange).toHaveBeenLastCalledWith(42, expect.objectContaining({ reason: "input-change" }));

      input.blur();
      tick();
      expect(input).toHaveValue("42");
      expect(onValueCommitted).toHaveBeenLastCalledWith(42, expect.objectContaining({ reason: "input-blur" }));
    });

    it("clears to null and commits when emptied", () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      const { el } = mount(() => <NumberFieldFixture onValueChange={onValueChange} onValueCommitted={onValueCommitted} />);
      const input = getByTestId(el, "input") as HTMLInputElement;

      input.focus();
      tick();
      typeInto(input, "");
      expect(onValueChange).toHaveBeenLastCalledWith(null, expect.objectContaining({ reason: "input-clear" }));

      input.blur();
      tick();
      expect(onValueCommitted).toHaveBeenLastCalledWith(null, expect.objectContaining({ reason: "input-clear" }));
    });

    it("keeps partial input visible while it is not yet parseable", () => {
      const onValueChange = vi.fn();
      const { el } = mount(() => <NumberFieldFixture onValueChange={onValueChange} />);
      const input = getByTestId(el, "input") as HTMLInputElement;

      input.focus();
      tick();
      typeInto(input, "-");
      expect(input.value).toBe("-");
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("pastes text at the caret position", () => {
      const { el } = mount(() => <NumberFieldFixture defaultValue={123} />);
      const input = getByTestId(el, "input") as HTMLInputElement;
      input.focus();
      tick();
      input.setSelectionRange(3, 3);

      pasteInto(input, "5");
      tick();
      expect(input.value).toBe("1235");
    });
  });

  describe("controlled mode and clamping", () => {
    it("follows the controlled value", () => {
      function Test() {
        let value: number | null = signal(5);
        return (
          <>
            <NumberField.Root value={value} onValueChange={(next) => (value = next)}>
              <NumberField.Group>
                <NumberField.Input data-testid="input" />
              </NumberField.Group>
            </NumberField.Root>
            <button data-testid="set" onClick={() => (value = 9)}>
              Set
            </button>
          </>
        );
      }
      const { el } = mount(() => <Test />);

      expect(getByTestId(el, "input")).toHaveValue("5");
      fire(getByTestId(el, "set"), "click");
      tick();
      expect(getByTestId(el, "input")).toHaveValue("9");
    });

    it("clamps step interactions to min/max but allows out-of-range typing when enabled", () => {
      const { el } = mount(() => <NumberFieldFixture defaultValue={10} min={0} max={10} allowOutOfRange />);
      const input = getByTestId(el, "input") as HTMLInputElement;

      pressKey(input, "ArrowUp");
      expect(input).toHaveValue("10");

      input.focus();
      tick();
      typeInto(input, "15");
      expect(input.value).toBe("15");
    });
  });

  describe("disabled and readOnly", () => {
    it("marks data attributes and ignores interaction when disabled", () => {
      const { el } = mount(() => <NumberFieldFixture disabled />);
      const root = getByTestId(el, "input").closest("div") as HTMLElement;

      expect(getByTestId(el, "input")).toBeDisabled();
      expect(root).toHaveAttribute("data-disabled");

      fire(getByTestId(el, "increment"), "click");
      tick();
      expect(getByTestId(el, "input")).toHaveValue("100");
    });

    it("blocks stepping when readOnly", () => {
      const { el } = mount(() => <NumberFieldFixture readOnly />);
      const input = getByTestId(el, "input") as HTMLInputElement;

      pressKey(input, "ArrowUp");
      expect(input).toHaveValue("100");

      // Read-only steppers stay focusable with unavailable semantics (no native disabled).
      const increment = getByTestId(el, "increment");
      expect(increment).toHaveAttribute("aria-disabled", "true");
      expect(increment).toHaveAttribute("data-readonly", "");
      fire(increment, "click");
      tick();
      expect(input).toHaveValue("100");
    });
  });

  describe("scrub area", () => {
    it("changes the value by dragging and commits on release", () => {
      const onValueCommitted = vi.fn();
      const { el } = mount(() => <NumberFieldFixture onValueCommitted={onValueCommitted} />);
      const input = getByTestId(el, "input") as HTMLInputElement;
      const scrubArea = getByTestId(el, "scrub-area");

      scrubArea.dispatchEvent(pointerEvent("pointerdown", { button: 0, pointerType: "mouse", clientX: 10, clientY: 10 }));
      tick();
      window.dispatchEvent(pointerEvent("pointermove", { movementX: 5, movementY: 0 }));
      tick();
      expect(input.value).toBe("105");

      window.dispatchEvent(pointerEvent("pointerup"));
      tick();
      expect(onValueCommitted).toHaveBeenLastCalledWith(105, expect.objectContaining({ reason: "scrub" }));
    });

    it("toggles the scrubbing state while scrubbing", () => {
      const { el } = mount(() => <NumberFieldFixture />);
      const root = getByTestId(el, "group").parentElement as HTMLElement;
      const scrubArea = getByTestId(el, "scrub-area");

      expect(root).not.toHaveAttribute("data-scrubbing");
      scrubArea.dispatchEvent(pointerEvent("pointerdown", { button: 0, pointerType: "mouse", clientX: 10, clientY: 10 }));
      tick();
      expect(root).toHaveAttribute("data-scrubbing");
      window.dispatchEvent(pointerEvent("pointerup"));
      tick();
      expect(root).not.toHaveAttribute("data-scrubbing");
    });
  });

  describe("field integration", () => {
    it("associates the input with the field label and fills the field", () => {
      const { el } = mount(() => (
        <Field.Root>
          <Field.Label data-testid="label">Amount</Field.Label>
          <NumberField.Root defaultValue={7}>
            <NumberField.Group>
              <NumberField.Input data-testid="input" />
            </NumberField.Group>
          </NumberField.Root>
        </Field.Root>
      ));

      const input = getByTestId(el, "input");
      const label = getByTestId(el, "label");
      expect(input.getAttribute("aria-labelledby")).toBe(label.getAttribute("id"));
      expect(input).toHaveValue("7");
    });
  });

  describe("wheel scrub", () => {
    it("steps the value on wheel while focused", () => {
      const onValueCommitted = vi.fn();
      const { el } = mount(() => <NumberFieldFixture allowWheelScrub onValueCommitted={onValueCommitted} />);
      const input = getByTestId(el, "input") as HTMLInputElement;
      input.focus();
      tick();

      input.dispatchEvent(wheelEvent({ deltaY: -100, deltaX: 0 }));
      tick();
      expect(input).toHaveValue("101");
      expect(onValueCommitted).toHaveBeenLastCalledWith(101, expect.objectContaining({ reason: "wheel" }));
    });

    it("ignores horizontal wheel events so the page can scroll instead", () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      const { el } = mount(() => <NumberFieldFixture allowWheelScrub onValueChange={onValueChange} onValueCommitted={onValueCommitted} />);
      const input = getByTestId(el, "input") as HTMLInputElement;
      input.focus();
      tick();

      input.dispatchEvent(wheelEvent({ deltaY: 0, deltaX: 100 }));
      tick();
      input.dispatchEvent(wheelEvent({ deltaY: 0, deltaX: -100 }));
      tick();
      // A precision touchpad emits sub-pixel noise on the cross axis during a sideways swipe.
      input.dispatchEvent(wheelEvent({ deltaY: -0.5, deltaX: 100 }));
      tick();
      input.dispatchEvent(wheelEvent({ deltaY: 0.5, deltaX: -100 }));
      tick();
      // An event with no movement at all.
      input.dispatchEvent(wheelEvent({ deltaY: 0, deltaX: 0 }));
      tick();

      expect(input).toHaveValue("100");
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueCommitted).not.toHaveBeenCalled();
    });

    it("scrubs on a vertical wheel event that carries horizontal noise", () => {
      const { el } = mount(() => <NumberFieldFixture allowWheelScrub />);
      const input = getByTestId(el, "input") as HTMLInputElement;
      input.focus();
      tick();

      input.dispatchEvent(wheelEvent({ deltaY: 1, deltaX: -0.5 }));
      tick();
      expect(input).toHaveValue("99");

      input.dispatchEvent(wheelEvent({ deltaY: -1, deltaX: 0.5 }));
      tick();
      expect(input).toHaveValue("100");
    });

    it("uses the horizontal delta for shift + wheel when the browser swaps the axis", () => {
      const { el } = mount(() => <NumberFieldFixture allowWheelScrub largeStep={10} />);
      const input = getByTestId(el, "input") as HTMLInputElement;
      input.focus();
      tick();

      // Chromium delivers shift + wheel as a horizontal event, so the horizontal delta carries
      // the intended direction.
      input.dispatchEvent(wheelEvent({ deltaY: 0, deltaX: -100, shiftKey: true }));
      tick();
      expect(input).toHaveValue("110");

      input.dispatchEvent(wheelEvent({ deltaY: 0, deltaX: 100, shiftKey: true }));
      tick();
      expect(input).toHaveValue("100");
    });
  });

  describe("focus selection", () => {
    it("keeps the selection the browser set when focus moves into the input", () => {
      const { el } = mount(() => <NumberFieldFixture />);
      const input = getByTestId(el, "input") as HTMLInputElement;

      // Tabbing into an input natively selects the whole value before the focus event fires.
      input.setSelectionRange(0, input.value.length);
      input.focus();
      tick();

      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    });

    it("places the caret at the end when a stepper press focuses the input", () => {
      const { el } = mount(() => <NumberFieldFixture />);
      const increment = getByTestId(el, "increment");
      const input = getByTestId(el, "input") as HTMLInputElement;

      increment.dispatchEvent(pointerEvent("pointerdown", { button: 0, pointerType: "mouse" }));
      tick();

      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(input.value.length);
      expect(input.selectionEnd).toBe(input.value.length);

      increment.dispatchEvent(pointerEvent("pointerup"));
      tick();
    });

    it("keeps a selection the consumer sets in onFocus when focus is forwarded", () => {
      const { el } = mount(() => (
        <NumberField.Root defaultValue={100}>
          <NumberField.Input data-testid="input" onFocus={(event) => (event.currentTarget as HTMLInputElement).select()} />
        </NumberField.Root>
      ));
      const input = getByTestId(el, "input") as HTMLInputElement;
      const hidden = el.querySelector('input[type="number"]') as HTMLInputElement;

      hidden.focus();
      tick();

      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    });
  });
});
