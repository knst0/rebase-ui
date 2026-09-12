import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SliderControl } from "../control/SliderControl";
import { SliderIndicator } from "../indicator/SliderIndicator";
import { SliderThumb } from "../thumb/SliderThumb";
import { SliderTrack } from "../track/SliderTrack";
import { SliderRoot } from "./SliderRoot";
import { Form } from "../../form";
import * as Field from "../../field/index.parts";

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

const realGetComputedStyle = window.getComputedStyle.bind(window);

beforeEach(() => {
  // jsdom reports nonzero default borders, which would skew pointer math.
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
  element.getBoundingClientRect = () =>
    ({ x: left, y: top, width, height, top, left, bottom, right, toJSON: () => ({}) }) as DOMRect;
}

function renderSingleSlider(props: Partial<SliderRoot.Props<number>> = {}, queryHidden = false) {
  const result = render(() => (
    <SliderRoot defaultValue={25} min={0} max={100} step={1} largeStep={10} {...props}>
      <SliderControl data-testid="control">
        <SliderTrack>
          <SliderIndicator />
          <SliderThumb aria-label="Volume" />
        </SliderTrack>
      </SliderControl>
    </SliderRoot>
  ));

  const control = screen.getByTestId("control");
  const input = screen.getByRole("slider", { name: "Volume", hidden: queryHidden }) as HTMLInputElement;
  const thumb = input.parentElement as HTMLElement;

  // A deterministic 200px-wide control with the thumb centered on value 25.
  // jsdom lacks pointer-capture APIs (present in real browsers); stub them.
  (control as any).hasPointerCapture = () => false;
  (control as any).releasePointerCapture = () => {};
  (control as any).setPointerCapture = () => {};
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
  const result = render(() => (
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

  const control = screen.getByTestId("control");
  const minInput = screen.getByRole("slider", { name: "Min" }) as HTMLInputElement;
  const maxInput = screen.getByRole("slider", { name: "Max" }) as HTMLInputElement;
  const thumb0 = minInput.parentElement as HTMLElement;

  (control as any).hasPointerCapture = () => false;
  (control as any).releasePointerCapture = () => {};
  (control as any).setPointerCapture = () => {};
  mockRect(control, { left: 0, right: 200 });
  mockRect(thumb0, { left: 32, right: 48 });

  return { ...result, control, minInput, maxInput, thumb0 };
}

async function pressKey(input: HTMLElement, key: string, shiftKey = false) {
  fireEvent.keyDown(input, { key, shiftKey });
  await flushEffects();
}

/** Presses on the first thumb of a range slider and drags it to clientX 170 (value 85). */
async function dragFirstThumbTo85(thumb0: HTMLElement) {
  fireEvent.pointerDown(thumb0, { clientX: 40, button: 0 });
  await flushEffects();
  for (const x of [80, 120, 170]) {
    fireEvent.pointerMove(document.body, { clientX: x, buttons: 1 });
  }
  await flushEffects();
  fireEvent.pointerUp(document.body, { clientX: 170 });
  await flushEffects();
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

    fireEvent.change(input, { target: { value: "42" } });
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

    fireEvent.pointerDown(control, { clientX: 100, button: 0 });
    await flushEffects();
    expect(changes).toEqual([[50, "track-press"]]);

    for (const x of [120, 140, 160]) {
      fireEvent.pointerMove(document.body, { clientX: x, buttons: 1 });
    }
    await flushEffects();

    expect(changes).toEqual([
      [50, "track-press"],
      [60, "drag"],
      [70, "drag"],
      [80, "drag"],
    ]);
    expect(group).toHaveAttribute("data-dragging", "");

    fireEvent.pointerUp(document.body, { clientX: 160 });
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

    fireEvent.pointerDown(thumb, { clientX: 50, button: 0 });
    await flushEffects();
    expect(changes).toEqual([]);

    for (const x of [70, 90]) {
      fireEvent.pointerMove(document.body, { clientX: x, buttons: 1 });
    }
    await flushEffects();

    expect(changes).toEqual([
      [35, "drag"],
      [45, "drag"],
    ]);

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
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

    fireEvent.touchStart(control, { changedTouches: [{ identifier: 7, clientX: 100, clientY: 10 }] });
    await flushEffects();
    expect(changes).toEqual([[50, "track-press"]]);
    expect(document.activeElement).toBe(input);

    for (const x of [130, 150]) {
      fireEvent.touchMove(document.body, { changedTouches: [{ identifier: 7, clientX: x, clientY: 10 }] });
    }
    await flushEffects();
    expect(changes).toEqual([
      [50, "track-press"],
      [65, "drag"],
      [75, "drag"],
    ]);

    fireEvent.touchEnd(document.body, { changedTouches: [{ identifier: 7, clientX: 150, clientY: 10 }] });
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

    fireEvent.pointerDown(control, { clientX: 20, button: 0 });
    const start = performance.now();
    // One macrotask per frame, like real browser pointer delivery: Solid 2 memos
    // refresh on task boundaries, so back-to-back synchronous dispatches would
    // observe stale values and are not representative.
    for (let x = 21; x <= 200; x += 1) {
      fireEvent.pointerMove(document.body, { clientX: x, buttons: 1 });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    const elapsed = performance.now() - start;
    fireEvent.pointerUp(document.body, { clientX: 200 });
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
    const { control } = renderSingleSlider({ thumbAlignment: "edge" }, true);

    expect(control).toHaveAttribute("data-base-ui-slider-control", "");

    // Inset thumbs stay visibility:hidden until effects measure them; query hidden
    // elements and wait for the measured positions to land.
    const input = screen.getByRole("slider", { name: "Volume", hidden: true }) as HTMLInputElement;
    const thumb = input.parentElement as HTMLElement;

    await waitFor(() => {
      expect(thumb.getAttribute("style")).toContain("--position: 27%");
    });
    expect(thumb.getAttribute("style")).not.toContain("visibility: hidden");

    const indicator = control.querySelector("[data-base-ui-slider-indicator]") as HTMLElement;
    expect(indicator.getAttribute("style")).toContain("--start-position: 27%");
  });

  it("runs field validation when the value changes", async () => {
    const validate = vi.fn(() => "Volume is required");
    render(() => (
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

    const input = screen.getByRole("slider", { name: "Volume" });
    fireEvent.keyDown(input, { key: "ArrowRight" });
    await flushEffects();

    expect(validate).toHaveBeenCalledWith(26, expect.anything());
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
