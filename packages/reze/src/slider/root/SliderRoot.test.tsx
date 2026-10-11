import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, settle, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { Show, signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import * as Field from "../../field/index.parts";
import { Form } from "../../form";
import { SliderControl } from "../control/SliderControl";
import { SliderIndicator } from "../indicator/SliderIndicator";
import { SliderLabel } from "../label/SliderLabel";
import { SliderThumb } from "../thumb/SliderThumb";
import { SliderTrack } from "../track/SliderTrack";
import { SliderValue } from "../value/SliderValue";
import { SliderRoot } from "./SliderRoot";
import * as SliderRootDataAttributes from "./SliderRootDataAttributes";

afterEach(cleanup);

function renderSlider(props: Partial<SliderRoot.Props<number>> = {}) {
  const result = mount(() => (
    <SliderRoot defaultValue={25} {...(props as SliderRoot.Props<number>)}>
      <SliderControl>
        <SliderTrack>
          <SliderIndicator />
          <SliderThumb aria-label="Volume" />
        </SliderTrack>
      </SliderControl>
    </SliderRoot>
  ));
  tick();
  return result;
}

function pressKey(input: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  fire(input, "keydown", { key, ...init } as KeyboardEventInit);
  tick();
}

async function flushEffects() {
  tick();
  await settle();
  tick();
}

describe("<Slider.Root />", () => {
  it("renders a div with group semantics by default", () => {
    renderSlider();

    expect(screen.getByRole("group").tagName).toBe("DIV");
  });

  it("renders the customized root element", () => {
    mount(() => (
      <SliderRoot defaultValue={25} as="span">
        <SliderControl>
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb aria-label="Volume" />
          </SliderTrack>
        </SliderControl>
      </SliderRoot>
    ));
    tick();

    expect(screen.getByRole("group").tagName).toBe("SPAN");
  });

  it("renders a group with a single range input thumb", () => {
    renderSlider();

    const root = screen.getByRole("group");
    expect(root).toHaveAttribute("data-orientation", "horizontal");

    const thumb = screen.getByRole("slider", { name: "Volume" });
    expect(thumb).toHaveAttribute("type", "range");
    expect(thumb).toHaveAttribute("aria-valuenow", "25");
    expect(thumb).toHaveAttribute("min", "0");
    expect(thumb).toHaveAttribute("max", "100");
  });

  it("increments with ArrowRight and reports the keyboard reason", () => {
    const handleChange = vi.fn();
    const handleCommit = vi.fn();
    renderSlider({ onValueChange: handleChange, onValueCommitted: handleCommit });

    const thumb = screen.getByRole("slider", { name: "Volume" });
    thumb.focus();
    pressKey(thumb, "ArrowRight");

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0]).toBe(26);
    expect(handleChange.mock.calls[0][1].reason).toBe("keyboard");
    expect(handleChange.mock.calls[0][1].activeThumbIndex).toBe(0);
    expect(handleCommit).toHaveBeenCalledTimes(1);
    expect(handleCommit.mock.calls[0][0]).toBe(26);
    expect(thumb).toHaveAttribute("aria-valuenow", "26");
  });

  it("jumps to min/max with Home/End", () => {
    renderSlider();

    const thumb = screen.getByRole("slider", { name: "Volume" });
    thumb.focus();
    pressKey(thumb, "End");
    expect(thumb).toHaveAttribute("aria-valuenow", "100");

    pressKey(thumb, "Home");
    expect(thumb).toHaveAttribute("aria-valuenow", "0");
  });

  it("keeps a controlled value while still reporting changes", () => {
    const handleChange = vi.fn();
    renderSlider({ value: 30, onValueChange: handleChange });

    const thumb = screen.getByRole("slider", { name: "Volume" });
    thumb.focus();
    pressKey(thumb, "ArrowRight");

    expect(handleChange).toHaveBeenCalledWith(31, expect.anything());
    expect(thumb).toHaveAttribute("aria-valuenow", "30");
  });

  it("marks the root as disabled and disables the thumb input", () => {
    renderSlider({ disabled: true });

    expect(screen.getByRole("group")).toHaveAttribute(SliderRootDataAttributes.disabled, "");
    expect(screen.getByRole("slider", { name: "Volume" })).toBeDisabled();
  });

  it("renders a range slider with one thumb per value", () => {
    const { el } = mount(() => (
      <SliderRoot defaultValue={[25, 75]}>
        <SliderLabel>Price range</SliderLabel>
        <SliderValue />
        <SliderControl>
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb index={0} aria-label="Minimum price" />
            <SliderThumb index={1} aria-label="Maximum price" />
          </SliderTrack>
        </SliderControl>
      </SliderRoot>
    ));
    tick();

    expect(screen.getByRole("slider", { name: "Minimum price" })).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByRole("slider", { name: "Maximum price" })).toHaveAttribute("aria-valuenow", "75");
    expect(el.querySelector('[data-index="0"]')).not.toBe(null);
    expect(el.querySelector('[data-index="1"]')).not.toBe(null);
    expect(screen.getByText("25 – 75")).not.toBe(null);
  });

  it("associates the label with the slider group", () => {
    mount(() => (
      <SliderRoot defaultValue={25}>
        <SliderLabel>Volume</SliderLabel>
        <SliderControl>
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb />
          </SliderTrack>
        </SliderControl>
      </SliderRoot>
    ));
    tick();

    const label = screen.getByText("Volume");
    expect(label.id).toMatch(/-label$/);
    expect(screen.getByRole("group")).toHaveAttribute("aria-labelledby", label.id);
  });

  it("does not re-fire the control ref on reactive updates", () => {
    const controlRef = vi.fn();
    mount(() => (
      <SliderRoot defaultValue={25}>
        <SliderControl ref={controlRef}>
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb aria-label="Volume" />
          </SliderTrack>
        </SliderControl>
      </SliderRoot>
    ));
    tick();

    expect(controlRef).toHaveBeenCalledTimes(1);

    const thumb = screen.getByRole("slider", { name: "Volume" });
    thumb.focus();
    pressKey(thumb, "ArrowRight");

    expect(thumb).toHaveAttribute("aria-valuenow", "26");
    expect(controlRef).toHaveBeenCalledTimes(1);
  });

  it("settles with a single registered thumb across control remounts", () => {
    function Test() {
      let shown = signal(true);
      return (
        <>
          <button type="button" onClick={() => (shown = !shown)}>
            toggle
          </button>
          <Show when={shown}>
            <SliderRoot defaultValue={25}>
              <SliderControl>
                <SliderTrack>
                  <SliderIndicator />
                  <SliderThumb aria-label="Volume" />
                </SliderTrack>
              </SliderControl>
            </SliderRoot>
          </Show>
        </>
      );
    }
    const { el } = mount(() => <Test />);
    tick();

    expect(screen.getAllByRole("slider")).toHaveLength(1);

    fire(el.querySelector("button")!, "click");
    tick();
    expect(screen.queryByRole("slider")).toBeNull();

    fire(el.querySelector("button")!, "click");
    tick();
    const thumbs = screen.getAllByRole("slider");
    expect(thumbs).toHaveLength(1);

    thumbs[0].focus();
    pressKey(thumbs[0], "ArrowRight");
    expect(thumbs[0]).toHaveAttribute("aria-valuenow", "26");
  });

  it("validationMode=onBlur preserves single-element array values", async () => {
    const validate = vi.fn(() => null);
    mount(() => (
      <Form>
        <Field.Root name="volume" validationMode="onBlur" validate={validate}>
          <SliderRoot defaultValue={[25]}>
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

    fire(screen.getByRole("slider", { name: "Volume" }), "blur");
    await flushEffects();

    expect(validate).toHaveBeenCalledWith([25], expect.anything());
  });
});
