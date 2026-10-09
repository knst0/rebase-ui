import "@testing-library/jest-dom/vitest";
import { fireEvent, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vite-plus/test";

import { createRenderer, describeConformance } from "#test-utils";

import { Form } from "../../form";
import * as Field from "../index.parts";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe("<Field.Error />", () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => (
      <Field.Root invalid>
        <Field.Error match {...props} />
      </Field.Root>
    ),
    () => ({
      render,
      defaultElement: "div",
      refInstanceof: window.HTMLDivElement,
    }),
  );

  it("should set aria-describedby on the control automatically", async () => {
    await render(() => (
      <Field.Root invalid>
        <Field.Control />
        <Field.Error match>Message</Field.Error>
      </Field.Root>
    ));

    expect(screen.getByRole("textbox")).toHaveAttribute("aria-describedby", screen.getByText("Message").id);
  });

  it("should show error messages by default", async () => {
    await render(() => (
      <Form>
        <Field.Root>
          <Field.Control required />
          <Field.Error>Message</Field.Error>
        </Field.Root>
        <button type="submit">submit</button>
      </Form>
    ));

    expect(screen.queryByText("Message")).toBe(null);

    const input = screen.getByRole<HTMLInputElement>("textbox");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    await flushMicrotasks();
    expect(screen.queryByText("Message")).toBe(null);

    fireEvent.click(screen.getByText("submit"));
    await flushMicrotasks();
    expect(screen.queryByText("Message")).not.toBe(null);
  });

  it("marks the error element with data-invalid when rendered", async () => {
    await render(() => (
      <Field.Root invalid>
        <Field.Error match data-testid="error">
          Message
        </Field.Error>
      </Field.Root>
    ));

    expect(screen.getByTestId("error")).toHaveAttribute("data-invalid", "");
  });
});
