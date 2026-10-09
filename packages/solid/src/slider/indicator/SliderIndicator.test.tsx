import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vite-plus/test";

import { SliderControl } from "../control/SliderControl";
import { SliderRoot } from "../root/SliderRoot";
import { SliderThumb } from "../thumb/SliderThumb";
import { SliderTrack } from "../track/SliderTrack";
import { SliderIndicator } from "./SliderIndicator";

function renderSlider(props: Partial<SliderRoot.Props<number[]>> = {}) {
  return render(() => (
    <SliderRoot defaultValue={[25]} min={0} max={100} {...props}>
      <SliderControl>
        <SliderTrack>
          <SliderIndicator data-testid="indicator" />
          <SliderThumb data-testid="thumb" aria-label="Volume" />
        </SliderTrack>
      </SliderControl>
    </SliderRoot>
  ));
}

function indicatorStyle() {
  return (screen.getByTestId("indicator") as HTMLElement).style;
}

describe("<Slider.Indicator />", () => {
  it("spans from the track start to the thumb for a single value", () => {
    renderSlider();

    // NB: asserted via `getPropertyValue` with the kebab-case name because Solid applies
    // object styles with `CSSStyleDeclaration.setProperty`, which silently drops camelCase
    // keys such as `insetInlineStart`.
    expect(indicatorStyle().getPropertyValue("inset-inline-start")).toBe("0px");
    expect(indicatorStyle().width).toBe("25%");
  });

  it("spans from the first thumb to the last thumb for a range", () => {
    render(() => (
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

    expect(indicatorStyle().getPropertyValue("inset-inline-start")).toBe("25%");
    expect(indicatorStyle().width).toBe("50%");
  });

  it("positions the thumb at the value", () => {
    renderSlider();

    expect((screen.getByTestId("thumb") as HTMLElement).style.getPropertyValue("inset-inline-start")).toBe("25%");
  });

  it("grows the indicator when the value increases", async () => {
    renderSlider();
    const user = userEvent.setup();

    const thumb = screen.getByRole("slider", { name: "Volume" });
    thumb.focus();
    await user.keyboard("{ArrowRight}");

    expect(indicatorStyle().getPropertyValue("inset-inline-start")).toBe("0px");
    expect(indicatorStyle().width).toBe("26%");
  });
});
