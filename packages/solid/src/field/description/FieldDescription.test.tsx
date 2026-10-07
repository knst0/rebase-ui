import "@testing-library/jest-dom/vitest";
import { screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { createRenderer, describeConformance } from "#test-utils";

import * as Field from "../index.parts";

describe("<Field.Description />", () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => (
      <Field.Root>
        <Field.Description {...props} />
      </Field.Root>
    ),
    () => ({
      render,
      defaultElement: "p",
      refInstanceof: window.HTMLParagraphElement,
    }),
  );

  it("should set aria-describedby on the control automatically", async () => {
    await render(() => (
      <Field.Root>
        <Field.Control />
        <Field.Description>Message</Field.Description>
      </Field.Root>
    ));

    expect(screen.getByRole("textbox")).toHaveAttribute("aria-describedby", screen.getByText("Message").id);
  });

  it("should preserve user aria-describedby values on the control", async () => {
    await render(() => (
      <Field.Root>
        <Field.Control aria-describedby="external-description" />
        <Field.Description>Message</Field.Description>
      </Field.Root>
    ));

    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe(`external-description ${screen.getByText("Message").id}`);
  });

  it("reflects the disabled state from Field.Item", async () => {
    await render(() => (
      <Field.Root>
        <Field.Item disabled>
          <Field.Description data-testid="description">Message</Field.Description>
        </Field.Item>
      </Field.Root>
    ));

    expect(screen.getByTestId("description")).toHaveAttribute("data-disabled");
  });
});
