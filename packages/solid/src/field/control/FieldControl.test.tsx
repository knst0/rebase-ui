import "@testing-library/jest-dom/vitest";
import { fireEvent, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { createRenderer, describeConformance } from "#test-utils";

import { Form } from "../../form";
import * as Field from "../index.parts";

describe("<Field.Control />", () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => (
      <Field.Root>
        <Field.Control {...props} />
      </Field.Root>
    ),
    () => ({
      render,
      defaultElement: "input",
      refInstanceof: window.HTMLInputElement,
    }),
  );

  it("renders a native input inside the field", async () => {
    await render(() => (
      <Field.Root>
        <Field.Control data-testid="control" />
      </Field.Root>
    ));

    expect(screen.getByTestId("control").tagName).toBe("INPUT");
  });

  it("validates once when changed by the user", async () => {
    const validate = vi.fn();

    await render(() => (
      <Field.Root validationMode="onChange" validate={validate}>
        <Field.Control />
      </Field.Root>
    ));

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a" } });
    flush();
    await Promise.resolve();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.lastCall?.[0]).toBe("a");
  });

  it("calls onValueChange with the new value", async () => {
    const onValueChange = vi.fn();

    await render(() => (
      <Field.Root validationMode="onChange">
        <Field.Control onValueChange={onValueChange} />
      </Field.Root>
    ));

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.lastCall?.[0]).toBe("abc");
  });

  it("shows a required error when a prefilled value is cleared", async () => {
    const onValueChange = vi.fn();
    await render(() => (
      <Field.Root validationMode="onChange">
        <Field.Control data-testid="control" defaultValue="value" required onValueChange={onValueChange} />
        <Field.Error match="valueMissing">Required</Field.Error>
      </Field.Root>
    ));

    const control = screen.getByTestId("control");

    fireEvent.change(control, { target: { value: "" } });
    flush();

    expect(onValueChange).toHaveBeenCalledWith("", expect.anything());
    await Promise.resolve();
    await Promise.resolve();
    flush();

    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("marks filled when a value is present", async () => {
    await render(() => (
      <Field.Root>
        <Field.Control data-testid="control" defaultValue="value" />
      </Field.Root>
    ));

    expect(screen.getByTestId("control")).toHaveAttribute("data-filled");
  });

  it("commits on Enter keydown", async () => {
    const validate = vi.fn(() => null);

    await render(() => (
      <Form>
        <Field.Root validate={validate}>
          <Field.Control />
        </Field.Root>
      </Form>
    ));

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    flush();
    await Promise.resolve();

    expect(validate).toHaveBeenCalledTimes(1);
  });
});
