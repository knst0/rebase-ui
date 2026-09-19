import "@testing-library/jest-dom/vitest";
import { fireEvent, screen, waitFor } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { createRenderer, describeConformance } from "#test-utils";

import { Form } from "../../form";
import * as Field from "../index.parts";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe("<Field.Root />", () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => <Field.Root {...props} />,
    () => ({
      render,
      defaultElement: "div",
      testAsWith: "section",
      refInstanceof: window.HTMLDivElement,
    }),
  );

  describe("prop: disabled", () => {
    it("should add data-disabled style hook to all components", async () => {
      await render(() => (
        <Field.Root disabled>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label">Label</Field.Label>
          <Field.Description data-testid="description">Description</Field.Description>
        </Field.Root>
      ));

      for (const part of ["control", "label", "description"]) {
        expect(screen.getByTestId(part)).toHaveAttribute("data-disabled");
      }
      expect(screen.getByRole("textbox")).toHaveAttribute("disabled");
    });

    it("keeps an explicitly invalid field marked invalid while disabled", async () => {
      const validate = vi.fn();

      await render(() => (
        <Field.Root invalid disabled validate={validate}>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      expect(screen.getByTestId("control")).toHaveAttribute("data-invalid", "");
      expect(screen.getByTestId("control")).toHaveAttribute("data-invalid", "");
    });
  });

  describe("prop: validate", () => {
    it("when not in a form, the function does not run by default", async () => {
      const validate = vi.fn(() => "error");

      await render(() => (
        <Field.Root validate={validate}>
          <Field.Control />
        </Field.Root>
      ));

      expect(validate).not.toHaveBeenCalled();
    });

    it("applies aria-invalid to the control after failed validation", async () => {
      await render(() => (
        <Form data-testid="form">
          <Field.Root name="test" validate={() => "error"} validationMode="onChange">
            <Field.Control data-testid="control" />
          </Field.Root>
        </Form>
      ));

      const control = screen.getByTestId("control");
      expect(control).not.toHaveAttribute("aria-invalid");

      fireEvent.change(control, { target: { value: "a" } });
      await flushMicrotasks();

      expect(control).toHaveAttribute("aria-invalid", "true");
    });

    it("receives all form values as the 2nd argument", async () => {
      const validate = vi.fn(() => null);

      await render(() => (
        <Form data-testid="form">
          <Field.Root name="first" validate={validate}>
            <Field.Control data-testid="first" />
          </Field.Root>
          <Field.Root name="second">
            <Field.Control data-testid="second" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      fireEvent.input(screen.getByTestId("second"), { target: { value: "hello" } });
      fireEvent.submit(screen.getByTestId("form"));
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledWith("", { first: "", second: "hello" });
    });
  });

  describe("prop: validationMode", () => {
    describe("onSubmit", () => {
      it("should validate the field on submit", async () => {
        await render(() => (
          <Form data-testid="form">
            <Field.Root validate={() => "error"}>
              <Field.Control />
              <Field.Error />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        expect(screen.queryByText("error")).toBe(null);

        fireEvent.submit(screen.getByTestId("form"));
        await flushMicrotasks();

        expect(screen.queryByText("error")).not.toBe(null);
      });

      it("revalidates on change", async () => {
        await render(() => (
          <Form data-testid="form">
            <Field.Root>
              <Field.Control type="url" required />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        const control = screen.getByRole<HTMLInputElement>("textbox");

        expect(screen.queryByTestId("error")).toBe(null);

        fireEvent.submit(screen.getByTestId("form"));
        await flushMicrotasks();
        expect(screen.queryByTestId("error")).not.toBe(null);

        fireEvent.change(control, { target: { value: "http://example" } });
        await flushMicrotasks();
        await waitFor(() => {
          expect(screen.queryByTestId("error")).toBe(null);
        });
      });
    });

    describe("onChange", () => {
      it("validates the field on change", async () => {
        await render(() => (
          <Field.Root
            validationMode="onChange"
            validate={(value) => {
              const str = value as string;
              return str.length < 3 ? "error" : null;
            }}
          >
            <Field.Control />
            <Field.Error />
          </Field.Root>
        ));

        const control = screen.getByRole<HTMLInputElement>("textbox");
        expect(screen.queryByText("error")).toBe(null);

        fireEvent.change(control, { target: { value: "t" } });
        await flushMicrotasks();

        expect(control).toHaveAttribute("data-invalid", "");
        expect(control).toHaveAttribute("aria-invalid", "true");
      });
    });

    describe("onBlur", () => {
      it("validates the field on blur", async () => {
        await render(() => (
          <Field.Root
            validationMode="onBlur"
            validate={(value) => {
              const str = value as string;
              return str.length < 3 ? "error" : null;
            }}
          >
            <Field.Control />
            <Field.Error />
          </Field.Root>
        ));

        const control = screen.getByRole<HTMLInputElement>("textbox");
        expect(screen.queryByText("error")).toBe(null);

        fireEvent.change(control, { target: { value: "t" } });
        expect(control).not.toHaveAttribute("data-invalid");

        fireEvent.blur(control);
        await flushMicrotasks();

        expect(control).toHaveAttribute("data-invalid", "");
        expect(control).toHaveAttribute("aria-invalid", "true");
      });

      it("should not mark invalid if `valueMissing` is the only error and not yet dirtied", async () => {
        await render(() => (
          <Field.Root validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>
        ));

        const control = screen.getByTestId("control");

        fireEvent.focus(control);
        fireEvent.blur(control);
        await flushMicrotasks();

        expect(control).not.toHaveAttribute("data-invalid");
        expect(control).not.toHaveAttribute("aria-invalid");
      });

      it("should mark invalid if `valueMissing` is the only error and dirtied", async () => {
        await render(() => (
          <Field.Root validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>
        ));

        const control = screen.getByTestId("control");

        fireEvent.focus(control);
        fireEvent.change(control, { target: { value: "a" } });
        fireEvent.change(control, { target: { value: "" } });
        fireEvent.blur(control);
        await flushMicrotasks();

        expect(control).toHaveAttribute("data-invalid", "");
        expect(control).toHaveAttribute("aria-invalid", "true");
      });

      it("supports async validation", async () => {
        await render(() => (
          <Field.Root validationMode="onBlur" validate={() => Promise.resolve("error")}>
            <Field.Control />
            <Field.Error />
          </Field.Root>
        ));

        const control = screen.getByRole("textbox");
        expect(screen.queryByText("error")).toBe(null);

        fireEvent.focus(control);
        fireEvent.blur(control);

        await waitFor(() => {
          expect(screen.queryByText("error")).not.toBe(null);
        });
      });
    });
  });

  describe("computed validity state", () => {
    it("should not mark field as invalid for valueMissing if not dirty", async () => {
      await render(() => (
        <Field.Root validationMode="onBlur">
          <Field.Control data-testid="control" required />
        </Field.Root>
      ));

      const control = screen.getByTestId("control");

      fireEvent.focus(control);
      fireEvent.blur(control);
      await flushMicrotasks();

      expect(control).toHaveAttribute("data-valid");
      expect(control).not.toHaveAttribute("data-invalid");
    });

    it("should mark field as invalid for other errors (e.g., typeMismatch) even if not dirty", async () => {
      await render(() => (
        <Field.Root validationMode="onBlur">
          <Field.Control data-testid="control" required type="email" defaultValue="a@b@c" />
        </Field.Root>
      ));

      const control = screen.getByTestId("control");

      fireEvent.focus(control);
      fireEvent.blur(control);
      await flushMicrotasks();

      expect(control).toHaveAttribute("data-invalid", "");
    });
  });

  it("commits validation when Enter is pressed in the control", async () => {
    const validate = vi.fn(() => null);

    await render(() => (
      <Form data-testid="form">
        <Field.Root validate={validate}>
          <Field.Control data-testid="control" />
        </Field.Root>
      </Form>
    ));

    fireEvent.keyDown(screen.getByTestId("control"), { key: "Enter" });
    await flushMicrotasks();

    expect(validate).toHaveBeenCalledTimes(1);
  });

  describe("prop: actionsRef", () => {
    it("validates the field when the `validate` method is called", async () => {
      const validate = vi.fn(() => "error");
      const [actions, setActions] = createSignal<Field.Root.Actions | null>(null);

      await render(() => (
        <Field.Root validate={validate} actionsRef={setActions}>
          <Field.Control />
        </Field.Root>
      ));

      actions()!.validate();
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(1);
    });

    it("releases the actions ref when the field unmounts", async () => {
      const [actions, setActions] = createSignal<Field.Root.Actions | null>(null);

      const { unmount } = await render(() => (
        <Field.Root actionsRef={setActions}>
          <Field.Control />
        </Field.Root>
      ));

      expect(actions()).not.toBeNull();

      unmount();
      flush();

      expect(actions()).toBeNull();
    });
  });
  describe("async validation pending state", () => {
    it("publishes neutral validity and raises the validating flag while a validator is in flight", async () => {
      let resolveValidate!: (value: string | null) => void;
      const validate = vi.fn(
        () =>
          new Promise<string | null>((resolve) => {
            resolveValidate = resolve;
          }),
      );

      await render(() => (
        <Field.Root data-testid="root" validationMode="onChange" validate={validate}>
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const root = screen.getByTestId("root");
      const control = screen.getByTestId("control");

      fireEvent.change(control, { target: { value: "taken" } });
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(1);
      // Validity is unknown mid-flight: neutral, error hidden, flag raised.
      expect(root).not.toHaveAttribute("data-valid");
      expect(root).not.toHaveAttribute("data-invalid");
      expect(root).toHaveAttribute("data-validating");
      expect(control).not.toHaveAttribute("aria-invalid");
      expect(screen.queryByTestId("error")).toBe(null);

      resolveValidate("Username is taken");
      await flushMicrotasks();
      await waitFor(() => {
        expect(root).toHaveAttribute("data-invalid", "");
      });

      expect(root).not.toHaveAttribute("data-validating");
      expect(control).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByTestId("error")).toHaveTextContent("Username is taken");
    });

    it("retires a superseded async run without clearing the latest pending flag", async () => {
      const resolvers: Array<(value: string | null) => void> = [];
      const validate = vi.fn(
        () =>
          new Promise<string | null>((resolve) => {
            resolvers.push(resolve);
          }),
      );

      await render(() => (
        <Field.Root data-testid="root" validationMode="onChange" validate={validate}>
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const root = screen.getByTestId("root");
      const control = screen.getByTestId("control");

      fireEvent.change(control, { target: { value: "a" } });
      await flushMicrotasks();
      expect(root).toHaveAttribute("data-validating");

      fireEvent.change(control, { target: { value: "ab" } });
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(2);
      expect(root).toHaveAttribute("data-validating");

      // The stale run resolves last: ignored, the latest run still owns the flag.
      resolvers[0]("stale error");
      await flushMicrotasks();
      expect(root).toHaveAttribute("data-validating");
      expect(root).not.toHaveAttribute("data-invalid");
      expect(screen.queryByTestId("error")).toBe(null);

      resolvers[1](null);
      await flushMicrotasks();
      await waitFor(() => {
        expect(root).toHaveAttribute("data-valid", "");
      });
      expect(root).not.toHaveAttribute("data-validating");
    });
  });
});
