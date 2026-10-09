import "@testing-library/jest-dom/vitest";
import { fireEvent, screen } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

import { createRenderer } from "#test-utils";

import { Form } from "../../form";
import * as Field from "../index.parts";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe("<Field.Validity />", () => {
  const { render } = createRenderer();

  describe("validationMode=onSubmit", () => {
    it("should pass validity data", async () => {
      const handleValidity = vi.fn();

      await render(() => (
        <Form>
          <Field.Root>
            <Field.Control required />
            <Field.Validity>{handleValidity}</Field.Validity>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const input = screen.getByRole<HTMLInputElement>("textbox");

      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(null);

      fireEvent.click(screen.getByText("submit"));
      await flushMicrotasks();

      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(false);
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(true);
      expect(handleValidity.mock.lastCall?.[0]).toHaveProperty("transitionStatus");

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "test" } });
      await flushMicrotasks();

      expect(handleValidity.mock.lastCall?.[0].value).toBe("test");
      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(true);
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(false);
    });
  });

  describe("validationMode=onBlur", () => {
    it("should pass validity data", async () => {
      const handleValidity = vi.fn();

      await render(() => (
        <Field.Root validationMode="onBlur">
          <Field.Control required />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>("textbox");

      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(null);

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.blur(input);
      await flushMicrotasks();

      expect(handleValidity.mock.lastCall?.[0].value).toBe("test");
      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(true);
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).toBe(false);
    });

    it("should correctly pass errors when validate function returns a string", async () => {
      const handleValidity = vi.fn();

      await render(() => (
        <Field.Root validationMode="onBlur" validate={() => "error"}>
          <Field.Control />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));

      fireEvent.focus(screen.getByRole<HTMLInputElement>("textbox"));
      fireEvent.blur(screen.getByRole<HTMLInputElement>("textbox"));
      await flushMicrotasks();

      expect(handleValidity.mock.lastCall?.[0].error).toBe("error");
      expect(handleValidity.mock.lastCall?.[0].errors).toEqual(["error"]);
    });

    it("should correctly pass errors when validate function returns an array of strings", async () => {
      const handleValidity = vi.fn();

      await render(() => (
        <Field.Root validationMode="onBlur" validate={() => ["1", "2"]}>
          <Field.Control />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));

      fireEvent.focus(screen.getByRole<HTMLInputElement>("textbox"));
      fireEvent.blur(screen.getByRole<HTMLInputElement>("textbox"));
      await flushMicrotasks();

      expect(handleValidity.mock.lastCall?.[0].error).toBe("1");
      expect(handleValidity.mock.lastCall?.[0].errors).toEqual(["1", "2"]);
    });

    it("marks invalid state from the invalid prop", async () => {
      const handleValidity = vi.fn();

      await render(() => (
        <Field.Root invalid>
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));

      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(false);
    });
  });
});
