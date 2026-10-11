import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { Form } from "../../form/Form";
import * as Field from "../index.parts";

afterEach(cleanup);

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

describe("<Field.Error />", () => {
  it("renders a div element", () => {
    const { el } = mount(() => (
      <Field.Root invalid>
        <Field.Error match data-testid="error">
          Message
        </Field.Error>
      </Field.Root>
    ));

    expect(getByTestId(el, "error").tagName).toBe("DIV");
  });

  it("renders the customized error element", () => {
    const { el } = mount(() => (
      <Field.Root invalid>
        <Field.Error match as="span" data-testid="error">
          Message
        </Field.Error>
      </Field.Root>
    ));

    expect(getByTestId(el, "error").tagName).toBe("SPAN");
  });

  it("attaches a callback ref to the error element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <Field.Root invalid>
        <Field.Error
          match
          data-testid="error"
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        >
          Message
        </Field.Error>
      </Field.Root>
    ));

    expect(instance).toBe(getByTestId(el, "error"));
    expect(instance).toBeInstanceOf(window.HTMLDivElement);
  });

  it("should set aria-describedby on the control automatically", () => {
    const { el } = mount(() => (
      <Field.Root invalid>
        <Field.Control />
        <Field.Error match data-testid="error">
          Message
        </Field.Error>
      </Field.Root>
    ));
    tick();

    expect(el.querySelector("input")).toHaveAttribute("aria-describedby", getByTestId(el, "error").id);
  });

  it("should show error messages by default", async () => {
    const { el } = mount(() => (
      <Form data-testid="form">
        <Field.Root>
          <Field.Control required data-testid="control" />
          <Field.Error>Message</Field.Error>
        </Field.Root>
        <button type="submit">submit</button>
      </Form>
    ));

    expect(el.textContent).not.toContain("Message");

    const input = getByTestId(el, "control") as HTMLInputElement;

    input.focus();
    tick();
    input.value = "a";
    fire(input, "change");
    tick();
    input.value = "";
    fire(input, "change");
    tick();
    input.blur();
    tick();
    await flushMicrotasks();
    expect(el.textContent).not.toContain("Message");

    fire(getByTestId(el, "form"), "submit");
    tick();
    await flushMicrotasks();
    expect(el.textContent).toContain("Message");
  });

  it("marks the error element with data-invalid when rendered", () => {
    const { el } = mount(() => (
      <Field.Root invalid>
        <Field.Error match data-testid="error">
          Message
        </Field.Error>
      </Field.Root>
    ));

    expect(getByTestId(el, "error")).toHaveAttribute("data-invalid", "");
  });
});
