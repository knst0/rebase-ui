import "@testing-library/jest-dom/vitest";
import { screen } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { createRenderer, describeConformance } from "#test-utils";

import * as Field from "../../field/index.parts";
import * as Fieldset from "../index.parts";

describe("<Fieldset.Root />", () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => <Fieldset.Root {...props} />,
    () => ({
      render,
      defaultElement: "fieldset",
      refInstanceof: window.HTMLFieldSetElement,
    }),
  );

  it("sets the native disabled attribute", async () => {
    await render(() => (
      <Fieldset.Root disabled data-testid="fieldset">
        <input />
      </Fieldset.Root>
    ));

    expect(screen.getByTestId("fieldset")).toHaveAttribute("disabled");
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("keeps nested fieldsets disabled when an ancestor fieldset is disabled", async () => {
    await render(() => (
      <Fieldset.Root disabled>
        <Fieldset.Root>
          <Field.Root>
            <Field.Control data-testid="control" />
          </Field.Root>
        </Fieldset.Root>
      </Fieldset.Root>
    ));

    expect(screen.getByTestId("control")).toHaveAttribute("disabled");
  });

  it("updates nested disabled precedence in both directions", async () => {
    const [outerDisabled, setOuterDisabled] = createSignal(false);
    const [innerDisabled, setInnerDisabled] = createSignal(true);

    await render(() => (
      <Fieldset.Root disabled={outerDisabled()}>
        <Fieldset.Root disabled={innerDisabled()}>
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
          </Field.Root>
        </Fieldset.Root>
      </Fieldset.Root>
    ));

    expect(screen.getByTestId("control")).toBeDisabled();
    expect(screen.getByTestId("root")).toHaveAttribute("data-disabled");

    setOuterDisabled(true);
    setInnerDisabled(false);
    flush();

    expect(screen.getByTestId("control")).toBeDisabled();
    expect(screen.getByTestId("root")).toHaveAttribute("data-disabled");

    setOuterDisabled(false);
    flush();

    expect(screen.getByTestId("control")).not.toBeDisabled();
    expect(screen.getByTestId("root")).not.toHaveAttribute("data-disabled");
  });
});
