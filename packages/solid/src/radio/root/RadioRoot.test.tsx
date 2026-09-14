import "@testing-library/jest-dom/vitest";
import { screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import { createRenderer, describeConformance, nextFrames } from "#test-utils";

import { RadioGroup } from "../../radio-group";
import { RadioIndicator } from "../indicator/RadioIndicator";
import { RadioRoot } from "./RadioRoot";
import * as RadioRootDataAttributes from "./RadioRootDataAttributes";

describe("<Radio.Root />", () => {
  const { render } = createRenderer();

  describeConformance((props) => <RadioRoot {...props} />, {
    defaultElement: "span",
  });

  it("renders unchecked with data-unchecked", async () => {
    await render(() => (
      <RadioGroup>
        <RadioRoot value="one" />
      </RadioGroup>
    ));

    const radio = screen.getByRole("radio");
    expect(radio).toHaveAttribute("aria-checked", "false");
    expect(radio).toHaveAttribute(RadioRootDataAttributes.unchecked, "");
    expect(radio).not.toHaveAttribute(RadioRootDataAttributes.checked);
  });

  it("reflects the checked state with data-checked", async () => {
    await render(() => (
      <RadioGroup defaultValue="one">
        <RadioRoot value="one" />
        <RadioRoot value="two" />
      </RadioGroup>
    ));

    const [radio1, radio2] = screen.getAllByRole("radio");
    expect(radio1).toHaveAttribute(RadioRootDataAttributes.checked, "");
    expect(radio1).not.toHaveAttribute(RadioRootDataAttributes.unchecked);
    expect(radio2).toHaveAttribute(RadioRootDataAttributes.unchecked, "");
  });

  it("renders the indicator only for the checked radio", async () => {
    const { user } = await render(() => (
      <RadioGroup defaultValue="one">
        <RadioRoot value="one">
          <RadioIndicator data-testid="indicator-one" />
        </RadioRoot>
        <RadioRoot value="two">
          <RadioIndicator data-testid="indicator-two" />
        </RadioRoot>
      </RadioGroup>
    ));

    expect(screen.getByTestId("indicator-one")).toBeInTheDocument();
    expect(screen.queryByTestId("indicator-two")).not.toBeInTheDocument();

    const [, radio2] = screen.getAllByRole("radio");
    await user.click(radio2);
    await nextFrames();

    expect(screen.queryByTestId("indicator-one")).not.toBeInTheDocument();
    expect(screen.getByTestId("indicator-two")).toBeInTheDocument();
  });

  it("does not toggle when disabled", async () => {
    const onValueChange = vi.fn();
    const { user } = await render(() => (
      <RadioGroup onValueChange={onValueChange}>
        <RadioRoot value="one" disabled />
        <RadioRoot value="two" />
      </RadioGroup>
    ));

    const [radio1] = screen.getAllByRole("radio");
    expect(radio1).toHaveAttribute("data-disabled");

    await user.click(radio1);

    expect(onValueChange).not.toHaveBeenCalled();
    expect(radio1).toHaveAttribute("aria-checked", "false");
  });

  it("applies nativeButton ids to the root instead of the hidden input", async () => {
    await render(() => (
      <RadioGroup>
        <RadioRoot value="one" nativeButton as="button" id="apple-radio" data-testid="radio" />
      </RadioGroup>
    ));

    const radio = screen.getByTestId("radio");
    expect(radio.tagName).toBe("BUTTON");
    expect(radio).toHaveAttribute("id", "apple-radio");

    const input = document.querySelector('input[type="radio"]') as HTMLInputElement | null;
    expect(input).not.toBe(null);
    expect(input?.id).toBe("");
  });

  it("marks the radio checked when standalone with an empty value", async () => {
    await render(() => <RadioRoot value="" data-testid="standalone" />);

    expect(screen.getByTestId("standalone")).toHaveAttribute("aria-checked", "true");
  });
});
