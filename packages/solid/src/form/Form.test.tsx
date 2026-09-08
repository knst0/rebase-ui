import "@testing-library/jest-dom/vitest";
import { fireEvent, screen, waitFor } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { createRenderer, describeConformance } from "#test-utils";

import * as Field from "../field/index.parts";
import { Form } from "./Form";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe("<Form />", () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => <Form {...props} />,
    () => ({
      render,
      defaultElement: "form",
      refInstanceof: window.HTMLFormElement,
    }),
  );

  it("submits values through onFormSubmit when valid", async () => {
    const submitSpy = vi.fn();

    await render(() => (
      <Form data-testid="form" onFormSubmit={submitSpy}>
        <Field.Root name="username">
          <Field.Control defaultValue="alice132" />
        </Field.Root>
        <button type="submit">submit</button>
      </Form>
    ));

    fireEvent.submit(screen.getByTestId("form"));
    await flushMicrotasks();

    expect(submitSpy.mock.calls.length).toBe(1);
    expect(submitSpy.mock.calls[0][0]).toEqual({ username: "alice132" });
    expect(submitSpy.mock.calls[0][1].reason).toBe("none");
  });

  it("does not submit if there are errors", async () => {
    const submitSpy = vi.fn();

    await render(() => (
      <Form data-testid="form" onSubmit={submitSpy}>
        <Field.Root name="username" validate={() => "This field is invalid."} validationMode="onChange">
          <Field.Control data-testid="username" />
          <Field.Error data-testid="error" match />
        </Field.Root>
        <button type="submit">submit</button>
      </Form>
    ));

    fireEvent.submit(screen.getByTestId("form"));
    await flushMicrotasks();

    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("does not run onFormSubmit when the form is invalid", async () => {
    const submitSpy = vi.fn();

    await render(() => (
      <Form data-testid="form" onFormSubmit={submitSpy}>
        <Field.Root name="username">
          <Field.Control defaultValue="" required />
          <Field.Error data-testid="error" />
        </Field.Root>
        <button type="submit">submit</button>
      </Form>
    ));

    expect(screen.queryByTestId("error")).toBe(null);
    fireEvent.submit(screen.getByTestId("form"));
    await flushMicrotasks();

    expect(submitSpy.mock.calls.length).toBe(0);
    expect(screen.queryByTestId("error")).not.toBe(null);
  });

  it("focuses the first invalid field on submit", async () => {
    await render(() => (
      <Form data-testid="form">
        <Field.Root name="one">
          <Field.Control data-testid="first" required />
        </Field.Root>
        <Field.Root name="two">
          <Field.Control data-testid="second" required />
        </Field.Root>
        <button type="submit">submit</button>
      </Form>
    ));

    fireEvent.submit(screen.getByTestId("form"));
    await flushMicrotasks();

    expect(screen.getByTestId("first")).toHaveFocus();
  });

  it("marks fields invalid from server errors and clears them upon change", async () => {
    const [serverErrors, setServerErrors] = createSignal<Record<string, string | string[]>>({ foo: "bar" });

    function App() {
      return (
        <Form errors={serverErrors()}>
          <Field.Root name="foo">
            <Field.Control data-testid="control" onChange={() => setServerErrors({})} />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      );
    }

    await render(() => <App />);

    expect(screen.getByTestId("error")).toHaveTextContent("bar");
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.queryByTestId("error")).toBe(null);
    });
  });

  it("revalidates fields on change after submission", async () => {
    const validate = vi.fn(() => null);

    await render(() => (
      <Form data-testid="form">
        <Field.Root name="foo" validate={validate}>
          <Field.Control data-testid="control" required />
        </Field.Root>
        <button type="submit">submit</button>
      </Form>
    ));

    expect(validate).not.toHaveBeenCalled();

    fireEvent.submit(screen.getByTestId("form"));
    await flushMicrotasks();
    expect(validate).toHaveBeenCalledTimes(1);

    const control = screen.getByTestId("control");
    control.focus();
    fireEvent.change(control, { target: { value: "" } });
    await flushMicrotasks();

    expect(validate).toHaveBeenCalledTimes(2);
  });

  describe("prop: noValidate", () => {
    it("should disable native validation if set to true (default)", async () => {
      await render(() => <Form data-testid="form" />);
      expect(screen.getByTestId("form")).toHaveAttribute("novalidate");
    });
  });

  describe("prop: actionsRef", () => {
    it("validates the form when the `validate` method is called", async () => {
      const validate = vi.fn(() => null);
      const actions: { current: Form.Actions | null } = { current: null };

      await render(() => (
        <Form actionsRef={actions}>
          <Field.Root name="test" validate={validate} validationMode="onChange">
            <Field.Control data-testid="control" />
          </Field.Root>
        </Form>
      ));

      expect(validate).not.toHaveBeenCalled();

      actions.current!.validate();
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(1);
    });

    it("validates a single field by name", async () => {
      const validateFirst = vi.fn(() => null);
      const validateSecond = vi.fn(() => null);
      const actions: { current: Form.Actions | null } = { current: null };

      await render(() => (
        <Form actionsRef={actions}>
          <Field.Root name="first" validate={validateFirst} validationMode="onChange">
            <Field.Control data-testid="first" />
          </Field.Root>
          <Field.Root name="second" validate={validateSecond} validationMode="onChange">
            <Field.Control data-testid="second" />
          </Field.Root>
        </Form>
      ));

      actions.current!.validate("second");
      await flushMicrotasks();

      expect(validateFirst).not.toHaveBeenCalled();
      expect(validateSecond).toHaveBeenCalledTimes(1);
    });
  });
});
