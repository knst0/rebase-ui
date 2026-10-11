import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, settle, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { signal } from "reze-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { nextFrames } from "../../../test/utils";
import * as Field from "../../field/index.parts";
import { Form } from "../../form";
import { SliderControl } from "../control/SliderControl";
import { SliderIndicator } from "../indicator/SliderIndicator";
import { SliderThumb } from "../thumb/SliderThumb";
import { SliderTrack } from "../track/SliderTrack";
import { SliderRoot } from "./SliderRoot";

afterEach(cleanup);

async function flushEffects() {
  tick();
  await settle();
  tick();
}

const realGetComputedStyle = window.getComputedStyle.bind(window);

beforeEach(() => {
  // happy-dom reports nonzero default borders, which would skew pointer math.
  // Zero them for deterministic geometry; the component reads them via getComputedStyle.
  window.getComputedStyle = (() => ({
    borderInlineStartWidth: "0px",
    borderInlineEndWidth: "0px",
    borderTopWidth: "0px",
    borderBottomWidth: "0px",
    paddingInlineStart: "0px",
    paddingInlineEnd: "0px",
    paddingTop: "0px",
    paddingBottom: "0px",
    getPropertyValue: () => "",
  })) as unknown as typeof window.getComputedStyle;
});

afterEach(() => {
  window.getComputedStyle = realGetComputedStyle;
});

function mockRect(element: Element, rect: { left: number; right: number; top?: number; bottom?: number }) {
  const { left, right, top = 0, bottom = 20 } = rect;
  const width = right - left;
  const height = bottom - top;
  element.getBoundingClientRect = () => ({ x: left, y: top, width, height, top, left, bottom, right, toJSON: () => ({}) }) as DOMRect;
}

function stubPointerCapture(control: Element) {
  // happy-dom lacks pointer-capture APIs (present in real browsers); stub them.
  (control as any).hasPointerCapture = () => false;
  (control as any).releasePointerCapture = () => {};
  (control as any).setPointerCapture = () => {};
}

function pointerEvent(type: string, init: Record<string, unknown> = {}): Event {
  // `fire` builds a plain Event for pointer types and drops custom init, so dispatch manually.
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, init);
  return event;
}

function touchEvent(type: string, init: Record<string, unknown> = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, init);
  return event;
}

function touch(target: Element, identifier: number, clientX: number, clientY = 10) {
  return { changedTouches: [{ identifier, target, clientX, clientY }] };
}

function renderSingleSlider(props: Partial<SliderRoot.Props<number>> = {}) {
  const result = mount(() => (
    <SliderRoot defaultValue={25} min={0} max={100} step={1} largeStep={10} {...(props as SliderRoot.Props<number>)}>
      <SliderControl data-testid="control">
        <SliderTrack>
          <SliderIndicator />
          <SliderThumb aria-label="Volume" />
        </SliderTrack>
      </SliderControl>
    </SliderRoot>
  ));
  tick();

  const control = screen.getByTestId("control");
  const input = screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement;
  const thumb = input.parentElement as HTMLElement;

  // A deterministic 200px-wide control with the thumb centered on value 25.
  stubPointerCapture(control);
  mockRect(control, { left: 0, right: 200 });
  mockRect(thumb, { left: 42, right: 58 });

  return { ...result, control, input, thumb };
}

function renderRangeSlider(
  behavior: SliderRoot.ThumbCollisionBehavior,
  callbacks: {
    onValueChange?: (value: readonly number[], reason: string) => void;
    onValueCommitted?: (value: readonly number[], reason: string) => void;
  } = {},
) {
  const result = mount(() => (
    <SliderRoot
      defaultValue={[20, 40]}
      thumbCollisionBehavior={behavior}
      onValueChange={(value, details) => callbacks.onValueChange?.(value as readonly number[], details.reason)}
      onValueCommitted={(value, details) => callbacks.onValueCommitted?.(value as readonly number[], details.reason)}
    >
      <SliderControl data-testid="control">
        <SliderTrack>
          <SliderIndicator />
          <SliderThumb index={0} aria-label="Min" />
          <SliderThumb index={1} aria-label="Max" />
        </SliderTrack>
      </SliderControl>
    </SliderRoot>
  ));
  tick();

  const control = screen.getByTestId("control");
  const minInput = screen.getByRole("slider", { name: "Min" }) as HTMLInputElement;
  const maxInput = screen.getByRole("slider", { name: "Max" }) as HTMLInputElement;
  const thumb0 = minInput.parentElement as HTMLElement;

  stubPointerCapture(control);
  mockRect(control, { left: 0, right: 200 });
  mockRect(thumb0, { left: 32, right: 48 });

  return { ...result, control, minInput, maxInput, thumb0 };
}

async function pressKey(input: HTMLElement, key: string, shiftKey = false) {
  fire(input, "keydown", { key, shiftKey } as KeyboardEventInit);
  await flushEffects();
}

/** Presses on the first thumb of a range slider and drags it to clientX 170 (value 85). */
async function dragFirstThumbTo85(thumb0: HTMLElement) {
  thumb0.dispatchEvent(pointerEvent("pointerdown", { clientX: 40, button: 0 }));
  await flushEffects();
  for (const x of [80, 120, 170]) {
    document.body.dispatchEvent(pointerEvent("pointermove", { clientX: x, buttons: 1 }));
  }
  await flushEffects();
  document.body.dispatchEvent(pointerEvent("pointerup", { clientX: 170 }));
  await flushEffects();
}

function renderCancelTestSlider() {
  const changes: Array<[unknown, string]> = [];
  const commits: Array<[unknown, string]> = [];
  const result = renderSingleSlider({
    defaultValue: 20,
    onValueChange: (value, details) => {
      changes.push([value, details.reason]);
    },
    onValueCommitted: (value, details) => {
      commits.push([value, details.reason]);
    },
  });

  return { ...result, changes, commits };
}

describe("<Slider /> interactions", () => {
  it("moves with arrows, pages, home/end, and shift-modified large steps", async () => {
    const changes: Array<[number, string]> = [];
    const commits: Array<[number, string]> = [];
    const { input } = renderSingleSlider({
      onValueChange: (value, details) => {
        changes.push([value, details.reason]);
      },
      onValueCommitted: (value, details) => {
        commits.push([value, details.reason]);
      },
    });

    await pressKey(input, "ArrowLeft");
    await pressKey(input, "ArrowDown");
    await pressKey(input, "ArrowUp");
    await pressKey(input, "ArrowRight");
    await pressKey(input, "PageUp");
    await pressKey(input, "PageDown");
    await pressKey(input, "ArrowRight", true);
    await pressKey(input, "ArrowLeft", true);
    await pressKey(input, "Home");
    await pressKey(input, "End");

    expect(changes.map(([value]) => value)).toEqual([24, 23, 24, 25, 35, 25, 35, 25, 0, 100]);
    expect(changes.every(([, reason]) => reason === "keyboard")).toBe(true);
    expect(commits.map(([value]) => value)).toEqual([24, 23, 24, 25, 35, 25, 35, 25, 0, 100]);
    expect(commits.every(([, reason]) => reason === "keyboard")).toBe(true);
    expect(input).toHaveAttribute("aria-valuenow", "100");
  });

  it("reports input-change for native input edits", async () => {
    const changes: Array<[number, string]> = [];
    const commits: Array<[number, string]> = [];
    const { input } = renderSingleSlider({
      onValueChange: (value, details) => {
        changes.push([value, details.reason]);
      },
      onValueCommitted: (value, details) => {
        commits.push([value, details.reason]);
      },
    });

    input.value = "42";
    fire(input, "change");
    await flushEffects();

    expect(changes).toEqual([[42, "input-change"]]);
    expect(commits).toEqual([[42, "input-change"]]);
    expect(input).toHaveAttribute("aria-valuenow", "42");
  });

  it("track-presses, drags across frames, and commits on release", async () => {
    const changes: Array<[number, string]> = [];
    const commits: Array<[number, string]> = [];
    const { control } = renderSingleSlider({
      onValueChange: (value, details) => {
        changes.push([value, details.reason]);
      },
      onValueCommitted: (value, details) => {
        commits.push([value, details.reason]);
      },
    });
    const group = screen.getByRole("group");

    control.dispatchEvent(pointerEvent("pointerdown", { clientX: 100, button: 0 }));
    await flushEffects();
    expect(changes).toEqual([[50, "track-press"]]);

    for (const x of [120, 140, 160]) {
      document.body.dispatchEvent(pointerEvent("pointermove", { clientX: x, buttons: 1 }));
    }
    await flushEffects();

    expect(changes).toEqual([
      [50, "track-press"],
      [60, "drag"],
      [70, "drag"],
      [80, "drag"],
    ]);
    expect(group).toHaveAttribute("data-dragging", "");

    document.body.dispatchEvent(pointerEvent("pointerup", { clientX: 160 }));
    await flushEffects();

    expect(commits).toEqual([[80, "drag"]]);
    expect(group).not.toHaveAttribute("data-dragging");
  });

  it("drags from the thumb without an initial track-press", async () => {
    const changes: Array<[number, string]> = [];
    const { input, thumb } = renderSingleSlider({
      onValueChange: (value, details) => {
        changes.push([value, details.reason]);
      },
    });

    thumb.dispatchEvent(pointerEvent("pointerdown", { clientX: 50, button: 0 }));
    await flushEffects();
    expect(changes).toEqual([]);

    for (const x of [70, 90]) {
      document.body.dispatchEvent(pointerEvent("pointermove", { clientX: x, buttons: 1 }));
    }
    await flushEffects();

    expect(changes).toEqual([
      [35, "drag"],
      [45, "drag"],
    ]);

    await nextFrames();
    expect(document.activeElement).toBe(input);
  });

  it("drags with touch and commits on release", async () => {
    const changes: Array<[number, string]> = [];
    const commits: Array<[number, string]> = [];
    const { control, input } = renderSingleSlider({
      onValueChange: (value, details) => {
        changes.push([value, details.reason]);
      },
      onValueCommitted: (value, details) => {
        commits.push([value, details.reason]);
      },
    });

    control.dispatchEvent(touchEvent("touchstart", touch(control, 7, 100)));
    await flushEffects();
    expect(changes).toEqual([[50, "track-press"]]);
    expect(document.activeElement).toBe(input);

    for (const x of [130, 150]) {
      document.body.dispatchEvent(touchEvent("touchmove", touch(control, 7, x)));
    }
    await flushEffects();
    expect(changes).toEqual([
      [50, "track-press"],
      [65, "drag"],
      [75, "drag"],
    ]);

    document.body.dispatchEvent(touchEvent("touchend", touch(control, 7, 150)));
    await flushEffects();
    expect(commits).toEqual([[75, "drag"]]);
  });

  it("processes a multi-frame drag without dropping values", async () => {
    const changes: number[] = [];
    const { control, input } = renderSingleSlider({
      onValueChange: (value) => {
        changes.push(value);
      },
    });

    control.dispatchEvent(pointerEvent("pointerdown", { clientX: 20, button: 0 }));
    tick();
    const start = performance.now();
    // One flush per frame, like real browser pointer delivery across task boundaries.
    for (let x = 21; x <= 200; x += 1) {
      document.body.dispatchEvent(pointerEvent("pointermove", { clientX: x, buttons: 1 }));
      tick();
    }
    const elapsed = performance.now() - start;
    document.body.dispatchEvent(pointerEvent("pointerup", { clientX: 200 }));
    await flushEffects();

    // Step 1 on a 200px control: press yields 10, then every second frame steps
    // to the next integer; unchanged values are suppressed, none are dropped.
    expect(changes.length).toBe(91);
    expect(new Set(changes).size).toBe(changes.length);
    expect(changes[changes.length - 1]).toBe(100);
    expect(input).toHaveAttribute("aria-valuenow", "100");
    expect(elapsed).toBeLessThan(30000);
  });

  it("pushes the second thumb when colliding in push mode", async () => {
    const changes: Array<[readonly number[], string]> = [];
    const commits: Array<[readonly number[], string]> = [];
    const { thumb0, minInput, maxInput } = renderRangeSlider("push", {
      onValueChange: (value, reason) => {
        changes.push([value, reason]);
      },
      onValueCommitted: (value, reason) => {
        commits.push([value, reason]);
      },
    });

    await dragFirstThumbTo85(thumb0);

    expect(changes[changes.length - 1]).toEqual([[85, 85], "drag"]);
    expect(commits).toEqual([[[85, 85], "drag"]]);
    expect(minInput).toHaveAttribute("aria-valuenow", "85");
    expect(maxInput).toHaveAttribute("aria-valuenow", "85");
  });

  it("clamps at the neighbor without passing through in none mode", async () => {
    const changes: Array<[readonly number[], string]> = [];
    const commits: Array<[readonly number[], string]> = [];
    const { thumb0, minInput, maxInput } = renderRangeSlider("none", {
      onValueChange: (value, reason) => {
        changes.push([value, reason]);
      },
      onValueCommitted: (value, reason) => {
        commits.push([value, reason]);
      },
    });

    await dragFirstThumbTo85(thumb0);

    expect(changes[changes.length - 1]).toEqual([[40, 40], "drag"]);
    expect(commits).toEqual([[[40, 40], "drag"]]);
    expect(minInput).toHaveAttribute("aria-valuenow", "40");
    expect(maxInput).toHaveAttribute("aria-valuenow", "40");
  });

  it("swaps thumbs and moves focus in swap mode", async () => {
    const changes: Array<[readonly number[], string]> = [];
    const { thumb0, minInput, maxInput } = renderRangeSlider("swap", {
      onValueChange: (value, reason) => {
        changes.push([value, reason]);
      },
    });

    await dragFirstThumbTo85(thumb0);

    expect(changes[changes.length - 1]).toEqual([[40, 85], "drag"]);
    expect(minInput).toHaveAttribute("aria-valuenow", "40");
    expect(maxInput).toHaveAttribute("aria-valuenow", "85");
    expect(document.activeElement).toBe(maxInput);
  });

  it("measures inset positions in edge alignment", async () => {
    const { control } = renderSingleSlider({ thumbAlignment: "edge" });

    expect(control).toHaveAttribute("data-base-ui-slider-control", "");

    // Inset thumbs stay visibility:hidden until effects measure them; query hidden
    // elements and wait for the measured positions to land.
    const input = screen.getByRole("slider", { name: "Volume", hidden: true }) as HTMLInputElement;
    const thumb = input.parentElement as HTMLElement;

    await flushEffects();
    await flushEffects();
    expect(thumb.getAttribute("style")).toContain("--position: 27%");
    expect(thumb.getAttribute("style")).not.toContain("visibility: hidden");

    const indicator = control.querySelector("[data-base-ui-slider-indicator]") as HTMLElement;
    expect(indicator.getAttribute("style")).toContain("--start-position: 27%");
  });

  it("runs field validation when the value changes", async () => {
    const validate = vi.fn(() => "Volume is required");
    mount(() => (
      <Form>
        <Field.Root name="volume" validate={validate} validationMode="onChange">
          <SliderRoot defaultValue={25}>
            <SliderControl>
              <SliderTrack>
                <SliderIndicator />
                <SliderThumb aria-label="Volume" />
              </SliderTrack>
            </SliderControl>
          </SliderRoot>
        </Field.Root>
      </Form>
    ));
    tick();

    const input = screen.getByRole("slider", { name: "Volume" });
    fire(input, "keydown", { key: "ArrowRight" } as KeyboardEventInit);
    await flushEffects();

    expect(validate).toHaveBeenCalledWith(26, expect.anything());
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("preserves single-element array values on track press", async () => {
    const changes: Array<[unknown, string]> = [];
    const commits: Array<[unknown, string]> = [];
    const { control } = renderSingleSlider({
      defaultValue: [25],
      onValueChange: (value: number | number[], details: SliderRoot.ChangeEventDetails) => {
        changes.push([value, details.reason]);
      },
      onValueCommitted: (value: number | readonly number[], details: SliderRoot.CommitEventDetails) => {
        commits.push([value, details.reason]);
      },
    } as unknown as Partial<SliderRoot.Props<number>>);

    control.dispatchEvent(pointerEvent("pointerdown", { clientX: 100, button: 0 }));
    await flushEffects();
    document.body.dispatchEvent(pointerEvent("pointerup", { clientX: 100 }));
    await flushEffects();

    expect(changes).toEqual([[[50], "track-press"]]);
    expect(commits).toEqual([[[50], "track-press"]]);
  });

  it.each(["touch", "pen"] as const)("commits a %s track tap", async (pointerType) => {
    const commits: Array<[unknown, string]> = [];
    function Test() {
      let value: number = signal(0);
      return (
        <SliderRoot
          value={value}
          onValueChange={(next) => {
            value = next as number;
          }}
          onValueCommitted={(next, details) => commits.push([next, details.reason])}
        >
          <SliderControl data-testid="control">
            <SliderTrack>
              <SliderIndicator />
              <SliderThumb aria-label="Volume" />
            </SliderTrack>
          </SliderControl>
        </SliderRoot>
      );
    }
    mount(() => <Test />);
    tick();

    const control = screen.getByTestId("control");
    stubPointerCapture(control);
    mockRect(control, { left: 0, right: 200 });

    // Browsers fire pointer events before the compatibility touch events, including for Apple Pencil.
    control.dispatchEvent(pointerEvent("pointerdown", { pointerType, pointerId: 1, button: 0, buttons: 1, clientX: 100 }));
    await flushEffects();
    control.dispatchEvent(touchEvent("touchstart", touch(control, 1, 100)));
    await flushEffects();
    control.dispatchEvent(pointerEvent("pointerup", { pointerType, pointerId: 1, clientX: 100 }));
    await flushEffects();
    document.body.dispatchEvent(touchEvent("touchend", touch(control, 1, 100)));
    await flushEffects();

    expect(commits).toEqual([[50, "track-press"]]);
  });

  it.each(["mouse", "pen", "touch"] as const)("handles a touch press normally after a cancelled %s gesture", async (pointerType) => {
    const changes: Array<[unknown, string]> = [];
    const commits: Array<[unknown, string]> = [];
    let preventPointerDown = false;
    mount(() => (
      <SliderRoot
        defaultValue={0}
        onValueChange={(next, details) => changes.push([next, details.reason])}
        onValueCommitted={(next, details) => commits.push([next, details.reason])}
      >
        <SliderControl
          data-testid="control"
          onPointerDown={(event) => {
            if (preventPointerDown) {
              event.preventDefault();
            }
          }}
        >
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb aria-label="Volume" />
          </SliderTrack>
        </SliderControl>
      </SliderRoot>
    ));
    tick();

    const control = screen.getByTestId("control");
    stubPointerCapture(control);
    mockRect(control, { left: 0, right: 200 });

    control.dispatchEvent(pointerEvent("pointerdown", { pointerType, pointerId: 1, button: 0, buttons: 1, clientX: 100 }));
    await flushEffects();
    if (pointerType === "touch") {
      control.dispatchEvent(touchEvent("touchstart", touch(control, 1, 100)));
      await flushEffects();
    }
    expect(changes.at(-1)).toEqual([50, "track-press"]);
    control.dispatchEvent(pointerEvent("pointercancel", { pointerType, pointerId: 1 }));
    await flushEffects();
    if (pointerType === "touch") {
      document.body.dispatchEvent(touchEvent("touchcancel", touch(control, 1, 100)));
      await flushEffects();
    }
    commits.length = 0;

    // Harness only: a prevented pointerdown still resets the flag but leaves the press to the
    // touch handler. Whether touch should respect the prevented pointerdown isn't pinned here.
    preventPointerDown = true;
    control.dispatchEvent(pointerEvent("pointerdown", { pointerType: "touch", pointerId: 2, button: 0, buttons: 1, clientX: 60 }));
    await flushEffects();
    control.dispatchEvent(touchEvent("touchstart", touch(control, 2, 60)));
    await flushEffects();
    expect(changes.at(-1)).toEqual([30, "track-press"]);

    control.dispatchEvent(pointerEvent("pointerup", { pointerType: "touch", pointerId: 2, clientX: 60 }));
    await flushEffects();
    document.body.dispatchEvent(touchEvent("touchend", touch(control, 2, 60)));
    await flushEffects();
    expect(commits).toEqual([[30, "track-press"]]);
  });

  it.each(["touch", "pen"] as const)("does not change the value on a %s tap on the thumb", async (pointerType) => {
    const changes: Array<[unknown, string]> = [];
    const { thumb } = renderSingleSlider({
      defaultValue: 100,
      step: 3,
      onValueChange: (value, details) => {
        changes.push([value, details.reason]);
      },
    });
    mockRect(thumb, { left: 190, right: 200 });

    thumb.dispatchEvent(pointerEvent("pointerdown", { pointerType, pointerId: 1, button: 0, buttons: 1, clientX: 195 }));
    await flushEffects();
    thumb.dispatchEvent(touchEvent("touchstart", touch(thumb, 1, 195)));
    await flushEffects();
    thumb.dispatchEvent(pointerEvent("pointerup", { pointerType, pointerId: 1, clientX: 195 }));
    await flushEffects();
    document.body.dispatchEvent(touchEvent("touchend", touch(thumb, 1, 195)));
    await flushEffects();

    expect(changes).toEqual([]);
  });

  describe("cancelled gestures", () => {
    it.each(["touchend", "touchcancel"] as const)("ignores %s from another finger during a touch drag", async (eventName) => {
      const { control, el, changes, commits } = renderCancelTestSlider();
      const elsewhere = el as HTMLElement;
      const pointer = { pointerId: 1, pointerType: "touch" };

      control.dispatchEvent(pointerEvent("pointerdown", { ...pointer, button: 0, buttons: 1, clientX: 80 }));
      await flushEffects();
      control.dispatchEvent(touchEvent("touchstart", touch(control, 1, 80)));
      await flushEffects();
      document.body.dispatchEvent(touchEvent("touchmove", touch(control, 1, 140)));
      await flushEffects();
      elsewhere.dispatchEvent(touchEvent("touchstart", touch(elsewhere, 2, 180)));
      elsewhere.dispatchEvent(touchEvent(eventName, touch(elsewhere, 2, 180)));
      await flushEffects();

      expect(commits).toEqual([]);
      expect(control).toHaveAttribute("data-dragging", "");

      document.body.dispatchEvent(touchEvent("touchmove", touch(control, 1, 160)));
      await flushEffects();
      expect(changes.at(-1)).toEqual([80, "drag"]);

      document.body.dispatchEvent(touchEvent("touchcancel", touch(control, 1, 160)));
      await flushEffects();
      expect(commits).toEqual([[80, "drag"]]);
      expect(control).not.toHaveAttribute("data-dragging");
    });

    it.each(["mouse", "pen"] as const)(
      "ends a cancelled %s drag after disabling and re-enabling during a touch drag",
      async (pointerType) => {
        const changes: Array<[unknown, string]> = [];
        const commits: Array<[unknown, string]> = [];
        function Test() {
          let disabled = signal(false);
          return (
            <>
              <button type="button" data-testid="toggle-disabled" onClick={() => (disabled = !disabled)}>
                toggle
              </button>
              <SliderRoot
                defaultValue={20}
                disabled={disabled}
                onValueChange={(next, details) => changes.push([next, details.reason])}
                onValueCommitted={(next, details) => commits.push([next, details.reason])}
              >
                <SliderControl data-testid="control">
                  <SliderTrack>
                    <SliderIndicator />
                    <SliderThumb aria-label="Volume" />
                  </SliderTrack>
                </SliderControl>
              </SliderRoot>
            </>
          );
        }
        const { el } = mount(() => <Test />);
        tick();
        const elsewhere = el as HTMLElement;

        const control = screen.getByTestId("control");
        stubPointerCapture(control);
        mockRect(control, { left: 0, right: 200 });

        control.dispatchEvent(pointerEvent("pointerdown", { pointerId: 1, pointerType: "touch", button: 0, buttons: 1, clientX: 80 }));
        await flushEffects();
        control.dispatchEvent(touchEvent("touchstart", touch(control, 1, 80)));
        await flushEffects();
        fire(screen.getByTestId("toggle-disabled"), "click");
        await flushEffects();
        document.body.dispatchEvent(touchEvent("touchcancel", touch(control, 1, 80)));
        await flushEffects();
        expect(commits).toEqual([]);
        fire(screen.getByTestId("toggle-disabled"), "click");
        await flushEffects();

        const pointer = { pointerId: 7, pointerType };
        control.dispatchEvent(pointerEvent("pointerdown", { ...pointer, button: 0, buttons: 1, clientX: 100 }));
        await flushEffects();
        document.body.dispatchEvent(pointerEvent("pointermove", { ...pointer, buttons: 1, clientX: 140 }));
        await flushEffects();
        document.body.dispatchEvent(pointerEvent("pointercancel", pointer));
        await flushEffects();

        expect(commits).toEqual([[70, "drag"]]);
        expect(control).not.toHaveAttribute("data-dragging");

        changes.length = 0;
        elsewhere.dispatchEvent(pointerEvent("pointermove", { ...pointer, buttons: 1, clientX: 180 }));
        elsewhere.dispatchEvent(pointerEvent("pointerup", { ...pointer, buttons: 0, clientX: 180 }));
        await flushEffects();
        expect(changes).toEqual([]);
        expect(commits).toHaveLength(1);
      },
    );

    it.each(["mouse", "pen"] as const)("commits and ends a %s drag on pointercancel", async (pointerType) => {
      const { control, el, changes, commits } = renderCancelTestSlider();
      const elsewhere = el as HTMLElement;
      const pointer = { pointerId: 7, pointerType };

      control.dispatchEvent(pointerEvent("pointerdown", { ...pointer, button: 0, buttons: 1, clientX: 80 }));
      await flushEffects();
      document.body.dispatchEvent(pointerEvent("pointermove", { ...pointer, buttons: 1, clientX: 140 }));
      await flushEffects();
      expect(control).toHaveAttribute("data-dragging", "");

      document.body.dispatchEvent(pointerEvent("pointercancel", pointer));
      await flushEffects();

      expect(commits).toEqual([[70, "drag"]]);
      expect(control).not.toHaveAttribute("data-dragging");

      changes.length = 0;
      elsewhere.dispatchEvent(pointerEvent("pointerdown", { ...pointer, button: 0, buttons: 1, clientX: 180 }));
      elsewhere.dispatchEvent(pointerEvent("pointermove", { ...pointer, buttons: 1, clientX: 180 }));
      elsewhere.dispatchEvent(pointerEvent("pointerup", { ...pointer, buttons: 0, clientX: 180 }));
      await flushEffects();

      expect(changes).toEqual([]);
      expect(commits).toHaveLength(1);
    });

    it("keeps a touch drag going after pointercancel and commits and ends it on touchcancel", async () => {
      const { control, el, changes, commits } = renderCancelTestSlider();
      const elsewhere = el as HTMLElement;
      const pointer = { pointerId: 1, pointerType: "touch" };

      control.dispatchEvent(pointerEvent("pointerdown", { ...pointer, button: 0, buttons: 1, clientX: 80 }));
      await flushEffects();
      control.dispatchEvent(touchEvent("touchstart", touch(control, 1, 80)));
      await flushEffects();
      // Without `touch-action: none`, the browser cancels the pointer once it starts panning.
      document.body.dispatchEvent(pointerEvent("pointercancel", pointer));
      await flushEffects();
      document.body.dispatchEvent(touchEvent("touchmove", touch(control, 1, 140)));
      await flushEffects();

      expect(changes.at(-1)).toEqual([70, "drag"]);

      document.body.dispatchEvent(touchEvent("touchcancel", touch(control, 1, 140)));
      await flushEffects();

      expect(commits).toEqual([[70, "drag"]]);
      expect(control).not.toHaveAttribute("data-dragging");

      changes.length = 0;
      elsewhere.dispatchEvent(pointerEvent("pointerdown", { pointerId: 2, pointerType: "touch", button: 0, buttons: 1 }));
      elsewhere.dispatchEvent(touchEvent("touchstart", touch(elsewhere, 2, 180)));
      document.body.dispatchEvent(touchEvent("touchmove", touch(elsewhere, 2, 180)));
      elsewhere.dispatchEvent(pointerEvent("pointerup", { pointerId: 2, pointerType: "touch", buttons: 0 }));
      document.body.dispatchEvent(touchEvent("touchend", touch(elsewhere, 2, 180)));
      await flushEffects();

      expect(changes).toEqual([]);
      expect(commits).toHaveLength(1);
    });
  });
});
