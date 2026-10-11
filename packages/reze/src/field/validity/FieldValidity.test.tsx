import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { afterEach, describe, expect, it, vi, type Mock } from "vite-plus/test";

import { Form } from "../../form/Form";
import * as Field from "../index.parts";
import type { FieldValidityState } from "./FieldValidity";

afterEach(cleanup);

type ValidityHandler = Mock<(state: FieldValidityState) => null>;

function lastValidity(handleValidity: ValidityHandler): FieldValidityState {
  const call = handleValidity.mock.lastCall;
  if (!call) {
    throw new Error("validity render prop was not called");
  }
  return call[0];
}

function getByTestId(root: ParentNode, testId: string): HTMLElement {
  const found = root.querySelector(`[data-testid="${testId}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error(`element with data-testid="${testId}" not found`);
  }
  return found;
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
  tick();
}

describe("<Field.Validity />", () => {
  describe("validationMode=onSubmit", () => {
    it("should pass validity data", async () => {
      const handleValidity = vi.fn(() => null);

      const { el } = mount(() => (
        <Form data-testid="form">
          <Field.Root>
            <Field.Control required data-testid="control" />
            <Field.Validity>{handleValidity}</Field.Validity>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));
      tick();

      const input = getByTestId(el, "control") as HTMLInputElement;

      expect(lastValidity(handleValidity).validity.valid).toBe(null);

      fire(getByTestId(el, "form"), "submit");
      tick();
      await flushMicrotasks();

      expect(lastValidity(handleValidity).validity.valid).toBe(false);
      expect(lastValidity(handleValidity).validity.valueMissing).toBe(true);
      expect(lastValidity(handleValidity)).toHaveProperty("transitionStatus");

      input.focus();
      tick();
      input.value = "test";
      fire(input, "change");
      tick();
      await flushMicrotasks();

      expect(lastValidity(handleValidity).value).toBe("test");
      expect(lastValidity(handleValidity).validity.valid).toBe(true);
      expect(lastValidity(handleValidity).validity.valueMissing).toBe(false);
    });
  });

  describe("validationMode=onBlur", () => {
    it("should pass validity data", async () => {
      const handleValidity = vi.fn(() => null);

      const { el } = mount(() => (
        <Field.Root validationMode="onBlur">
          <Field.Control required data-testid="control" />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));
      tick();

      const input = getByTestId(el, "control") as HTMLInputElement;

      expect(lastValidity(handleValidity).validity.valid).toBe(null);

      input.focus();
      tick();
      input.value = "test";
      fire(input, "change");
      tick();
      input.blur();
      tick();
      await flushMicrotasks();

      expect(lastValidity(handleValidity).value).toBe("test");
      expect(lastValidity(handleValidity).validity.valid).toBe(true);
      expect(lastValidity(handleValidity).validity.valueMissing).toBe(false);
    });

    it("should correctly pass errors when validate function returns a string", async () => {
      const handleValidity = vi.fn(() => null);

      const { el } = mount(() => (
        <Field.Root validationMode="onBlur" validate={() => "error"}>
          <Field.Control data-testid="control" />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));
      tick();

      const input = getByTestId(el, "control") as HTMLInputElement;
      input.focus();
      tick();
      input.blur();
      tick();
      await flushMicrotasks();

      expect(lastValidity(handleValidity).error).toBe("error");
      expect(lastValidity(handleValidity).errors).toEqual(["error"]);
    });

    it("should correctly pass errors when validate function returns an array of strings", async () => {
      const handleValidity = vi.fn(() => null);

      const { el } = mount(() => (
        <Field.Root validationMode="onBlur" validate={() => ["1", "2"]}>
          <Field.Control data-testid="control" />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));
      tick();

      const input = getByTestId(el, "control") as HTMLInputElement;
      input.focus();
      tick();
      input.blur();
      tick();
      await flushMicrotasks();

      expect(lastValidity(handleValidity).error).toBe("1");
      expect(lastValidity(handleValidity).errors).toEqual(["1", "2"]);
    });

    it("marks invalid state from the invalid prop", () => {
      const handleValidity = vi.fn(() => null);

      mount(() => (
        <Field.Root invalid>
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));
      tick();

      expect(lastValidity(handleValidity).validity.valid).toBe(false);
    });
  });
});
