import "@testing-library/jest-dom/vitest";
import { screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { createRenderer, describeConformance } from "#test-utils";

import * as Fieldset from "../index.parts";

describe("<Fieldset.Legend />", () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => (
      <Fieldset.Root>
        <Fieldset.Legend {...props} />
      </Fieldset.Root>
    ),
    () => ({
      render,
      defaultElement: "div",
      refInstanceof: window.HTMLDivElement,
      skip: ["rootElement"],
    }),
  );

  it("sets aria-labelledby on the fieldset automatically", async () => {
    await render(() => (
      <Fieldset.Root>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>
    ));

    expect(screen.getByRole("group")).toHaveAttribute("aria-labelledby", screen.getByTestId("legend").id);
  });

  it("sets aria-labelledby on the fieldset with a custom id", async () => {
    await render(() => (
      <Fieldset.Root>
        <Fieldset.Legend id="legend-id" />
      </Fieldset.Root>
    ));

    expect(screen.getByRole("group")).toHaveAttribute("aria-labelledby", "legend-id");
  });

  it("updates and clears the legend association", async () => {
    const [legendId, setLegendId] = createSignal("legend-a");
    const [showLegend, setShowLegend] = createSignal(true);

    await render(() => <Fieldset.Root>{showLegend() ? <Fieldset.Legend id={legendId()}>Legend</Fieldset.Legend> : null}</Fieldset.Root>);

    expect(screen.getByRole("group")).toHaveAttribute("aria-labelledby", "legend-a");

    setLegendId("legend-b");
    flush();
    expect(screen.getByRole("group")).toHaveAttribute("aria-labelledby", "legend-b");

    setShowLegend(false);
    flush();
    expect(screen.getByRole("group")).not.toHaveAttribute("aria-labelledby");
  });

  it("throws a descriptive error when rendered outside <Fieldset.Root>", async () => {
    await expect(render(() => <Fieldset.Legend />)).rejects.toThrow(
      "Rebase UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.",
    );
  });
});
