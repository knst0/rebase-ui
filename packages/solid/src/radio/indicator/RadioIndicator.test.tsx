import "@testing-library/jest-dom/vitest";
import { screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vite-plus/test";

import { createRenderer } from "#test-utils";

import { RadioGroup } from "../../radio-group";
import { RadioRoot } from "../root/RadioRoot";
import { RadioIndicator } from "./RadioIndicator";

describe("<Radio.Indicator />", () => {
  const { render } = createRenderer();

  it("is hidden when the radio is unchecked", async () => {
    await render(() => (
      <RadioGroup>
        <RadioRoot value="one">
          <RadioIndicator data-testid="indicator" />
        </RadioRoot>
      </RadioGroup>
    ));

    expect(screen.queryByTestId("indicator")).not.toBeInTheDocument();
  });

  it("is shown when the radio is checked", async () => {
    await render(() => (
      <RadioGroup defaultValue="one">
        <RadioRoot value="one">
          <RadioIndicator data-testid="indicator" />
        </RadioRoot>
      </RadioGroup>
    ));

    expect(screen.getByTestId("indicator")).toBeInTheDocument();
  });

  it("stays mounted with keepMounted when the radio is unchecked", async () => {
    await render(() => (
      <RadioGroup>
        <RadioRoot value="one">
          <RadioIndicator keepMounted data-testid="indicator" />
        </RadioRoot>
      </RadioGroup>
    ));

    expect(screen.getByTestId("indicator")).toBeInTheDocument();
  });
});
