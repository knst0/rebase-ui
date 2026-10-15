import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { SliderControl } from "../control/SliderControl";
import { SliderRoot } from "../root/SliderRoot";
import { SliderThumb } from "../thumb/SliderThumb";
import { SliderTrack } from "../track/SliderTrack";
import { SliderIndicator } from "./SliderIndicator";

afterEach(cleanup);

function renderSlider(props: Partial<SliderRoot.Props<number[]>> = {}) {
  const result = mount(() => (
    <SliderRoot defaultValue={[25]} min={0} max={100} {...(props as SliderRoot.Props<number[]>)}>
      <SliderControl>
        <SliderTrack>
          <SliderIndicator data-testid="indicator" />
          <SliderThumb data-testid="thumb" aria-label="Volume" />
        </SliderTrack>
      </SliderControl>
    </SliderRoot>
  ));
  tick();
  return result;
}

function indicatorStyle() {
  return (screen.getByTestId("indicator") as HTMLElement).style;
}

function pressKey(input: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  fire(input, "keydown", { key, ...init } as KeyboardEventInit);
  tick();
}

describe("<Slider.Indicator />", () => {
  it("spans from the track start to the thumb for a single value", () => {
    renderSlider();

    // NB: asserted via `getPropertyValue` with the kebab-case name because object
    // styles are applied with `CSSStyleDeclaration.setProperty`, which silently
    // drops camelCase keys such as `insetInlineStart`. happy-dom reports the
    // unitless zero as-is instead of serializing it to `0px` like browsers do.
    expect(indicatorStyle().getPropertyValue("inset-inline-start")).toBe("0");
    expect(indicatorStyle().width).toBe("25%");
  });

  it("spans from the first thumb to the last thumb for a range", () => {
    mount(() => (
      <SliderRoot defaultValue={[25, 75]} min={0} max={100}>
        <SliderControl>
          <SliderTrack>
            <SliderIndicator data-testid="indicator" />
            <SliderThumb aria-label="Min" />
            <SliderThumb aria-label="Max" />
          </SliderTrack>
        </SliderControl>
      </SliderRoot>
    ));
    tick();

    expect(indicatorStyle().getPropertyValue("inset-inline-start")).toBe("25%");
    expect(indicatorStyle().width).toBe("50%");
  });

  it("positions the thumb at the value", () => {
    renderSlider();

    expect((screen.getByTestId("thumb") as HTMLElement).style.getPropertyValue("inset-inline-start")).toBe("25%");
  });

  it("grows the indicator when the value increases", () => {
    renderSlider();

    const thumb = screen.getByRole("slider", { name: "Volume" });
    thumb.focus();
    pressKey(thumb, "ArrowRight");

    expect(indicatorStyle().getPropertyValue("inset-inline-start")).toBe("0");
    expect(indicatorStyle().width).toBe("26%");
  });
});
