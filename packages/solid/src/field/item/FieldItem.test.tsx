import "@testing-library/jest-dom/vitest";
import { screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vite-plus/test";

import { createRenderer, describeConformance } from "#test-utils";

import * as Field from "../index.parts";

describe("<Field.Item />", () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => (
      <Field.Root>
        <Field.Item {...props} />
      </Field.Root>
    ),
    () => ({
      render,
      defaultElement: "div",
      refInstanceof: window.HTMLDivElement,
    }),
  );

  it("reflects disabled state on the item", async () => {
    await render(() => (
      <Field.Root>
        <Field.Item disabled data-testid="item" />
      </Field.Root>
    ));

    expect(screen.getByTestId("item")).toHaveAttribute("data-disabled");
  });

  it("does not mark enabled items as disabled", async () => {
    await render(() => (
      <Field.Root disabled>
        <Field.Item data-testid="item" />
      </Field.Root>
    ));

    expect(screen.getByTestId("item")).toHaveAttribute("data-disabled");
  });

  it("inherits the root's validity state attributes", async () => {
    await render(() => (
      <Field.Root invalid>
        <Field.Item data-testid="item" />
      </Field.Root>
    ));

    expect(screen.getByTestId("item")).toHaveAttribute("data-invalid", "");
  });
});
