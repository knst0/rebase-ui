import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { describeConformance } from "#test-utils";

import { SliderControl } from "../control/SliderControl";
import { SliderIndicator } from "../indicator/SliderIndicator";
import { SliderLabel } from "../label/SliderLabel";
import { SliderThumb } from "../thumb/SliderThumb";
import { SliderTrack } from "../track/SliderTrack";
import { SliderValue } from "../value/SliderValue";
import { SliderRoot } from "./SliderRoot";
import * as SliderRootDataAttributes from "./SliderRootDataAttributes";

function renderSlider(props: Partial<SliderRoot.Props<number>> = {}) {
  return render(() => (
    <SliderRoot defaultValue={25} {...props}>
      <SliderControl>
        <SliderTrack>
          <SliderIndicator />
          <SliderThumb aria-label="Volume" />
        </SliderTrack>
      </SliderControl>
    </SliderRoot>
  ));
}

describe("<Slider.Root />", () => {
  describeConformance((props) => <SliderRoot {...props} />, {
    defaultElement: "div",
    as: { targetElement: "span" },
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

  it("increments with ArrowRight and reports the keyboard reason", async () => {
    const handleChange = vi.fn();
    const handleCommit = vi.fn();
    const user = userEvent.setup();
    renderSlider({ onValueChange: handleChange, onValueCommitted: handleCommit });

    const thumb = screen.getByRole("slider", { name: "Volume" });
    thumb.focus();
    await user.keyboard("{ArrowRight}");

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0]).toBe(26);
    expect(handleChange.mock.calls[0][1].reason).toBe("keyboard");
    expect(handleChange.mock.calls[0][1].activeThumbIndex).toBe(0);
    expect(handleCommit).toHaveBeenCalledTimes(1);
    expect(handleCommit.mock.calls[0][0]).toBe(26);
    expect(thumb).toHaveAttribute("aria-valuenow", "26");
  });

  it("jumps to min/max with Home/End", async () => {
    const user = userEvent.setup();
    renderSlider();

    const thumb = screen.getByRole("slider", { name: "Volume" });
    thumb.focus();
    await user.keyboard("{End}");
    expect(thumb).toHaveAttribute("aria-valuenow", "100");

    await user.keyboard("{Home}");
    expect(thumb).toHaveAttribute("aria-valuenow", "0");
  });

  it("keeps a controlled value while still reporting changes", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    renderSlider({ value: 30, onValueChange: handleChange });

    const thumb = screen.getByRole("slider", { name: "Volume" });
    thumb.focus();
    await user.keyboard("{ArrowRight}");

    expect(handleChange).toHaveBeenCalledWith(31, expect.anything());
    expect(thumb).toHaveAttribute("aria-valuenow", "30");
  });

  it("marks the root as disabled and disables the thumb input", () => {
    renderSlider({ disabled: true });

    expect(screen.getByRole("group")).toHaveAttribute(SliderRootDataAttributes.disabled, "");
    expect(screen.getByRole("slider", { name: "Volume" })).toBeDisabled();
  });

  it("renders a range slider with one thumb per value", () => {
    const { container } = render(() => (
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

    expect(screen.getByRole("slider", { name: "Minimum price" })).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByRole("slider", { name: "Maximum price" })).toHaveAttribute("aria-valuenow", "75");
    expect(container.querySelector('[data-index="0"]')).not.toBe(null);
    expect(container.querySelector('[data-index="1"]')).not.toBe(null);
    expect(screen.getByText("25 – 75")).not.toBe(null);
  });

  it("associates the label with the slider group", () => {
    render(() => (
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

    const label = screen.getByText("Volume");
    expect(label.id).toMatch(/-label$/);
    expect(screen.getByRole("group")).toHaveAttribute("aria-labelledby", label.id);
  });

  it("does not re-fire the control ref on reactive updates", async () => {
    const controlRef = vi.fn();
    const user = userEvent.setup();
    render(() => (
      <SliderRoot defaultValue={25}>
        <SliderControl ref={controlRef}>
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb aria-label="Volume" />
          </SliderTrack>
        </SliderControl>
      </SliderRoot>
    ));

    expect(controlRef).toHaveBeenCalledTimes(1);

    const thumb = screen.getByRole("slider", { name: "Volume" });
    thumb.focus();
    await user.keyboard("{ArrowRight}");

    expect(thumb).toHaveAttribute("aria-valuenow", "26");
    expect(controlRef).toHaveBeenCalledTimes(1);
  });

  it("settles with a single registered thumb across control remounts", async () => {
    const user = userEvent.setup();
    render(() => {
      const [shown, setShown] = createSignal(true);
      return (
        <>
          <button type="button" onClick={() => setShown((value) => !value)}>
            toggle
          </button>
          {shown() ? (
            <SliderRoot defaultValue={25}>
              <SliderControl>
                <SliderTrack>
                  <SliderIndicator />
                  <SliderThumb aria-label="Volume" />
                </SliderTrack>
              </SliderControl>
            </SliderRoot>
          ) : null}
        </>
      );
    });

    expect(screen.getAllByRole("slider")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.queryByRole("slider")).toBeNull();

    await user.click(screen.getByRole("button", { name: "toggle" }));
    const thumbs = screen.getAllByRole("slider");
    expect(thumbs).toHaveLength(1);

    thumbs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(thumbs[0]).toHaveAttribute("aria-valuenow", "26");
  });
});
