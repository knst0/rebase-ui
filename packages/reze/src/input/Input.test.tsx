import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { Field } from "../field";
import { Input } from "./Input";
import * as InputDataAttributes from "./InputDataAttributes";

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

describe("<Input />", () => {
  it("renders a native input element", () => {
    const { el } = mount(() => <Input data-testid="input" />);

    expect(getByTestId(el, "input").tagName).toBe("INPUT");
  });

  it("renders the customized input element", () => {
    const { el } = mount(() => <Input as="textarea" data-testid="input" />);

    expect(getByTestId(el, "input").tagName).toBe("TEXTAREA");
  });

  it("attaches a callback ref to the input element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <Input
        ref={(value: HTMLElement) => {
          instance = value;
        }}
      />
    ));

    expect(instance).toBe(el.querySelector("input"));
    expect(instance).toBeInstanceOf(window.HTMLInputElement);
  });

  it("supports an uncontrolled defaultValue and reports changes via onValueChange", () => {
    const onValueChange = vi.fn();

    const { el } = mount(() => <Input data-testid="input" defaultValue="initial" onValueChange={onValueChange} />);

    const input = getByTestId(el, "input") as HTMLInputElement;
    expect(input.value).toBe("initial");

    input.value = "typed";
    fire(input, "change");
    tick();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.lastCall?.[0]).toBe("typed");
  });

  it("supports a controlled value", () => {
    function Test() {
      let value: string = signal("a");
      return <Input data-testid="input" value={value} onValueChange={(next) => (value = next)} />;
    }
    const { el } = mount(() => <Test />);

    const input = getByTestId(el, "input") as HTMLInputElement;
    expect(input.value).toBe("a");

    input.value = "ab";
    fire(input, "change");
    tick();

    expect(input.value).toBe("ab");
  });

  it("forwards the disabled state", () => {
    const { el } = mount(() => <Input data-testid="input" disabled />);

    const input = getByTestId(el, "input");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute(InputDataAttributes.disabled);
  });

  it("works inside Field.Root with label, filled, and error states", async () => {
    const { el } = mount(() => (
      <Field.Root validationMode="onChange">
        <Field.Label>Name</Field.Label>
        <Input data-testid="input" defaultValue="value" required />
        <Field.Error match="valueMissing">Required</Field.Error>
      </Field.Root>
    ));

    const input = getByTestId(el, "input");
    expect(input).toHaveAttribute(InputDataAttributes.filled);
    expect((el.querySelector("label") as HTMLLabelElement).getAttribute("for")).toBe(input.getAttribute("id"));

    (input as HTMLInputElement).value = "";
    fire(input, "change");
    tick();
    await flushMicrotasks();

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(el.textContent).toContain("Required");
  });

  it("marks touched and focused state attributes on focus and blur", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Input data-testid="input" />
      </Field.Root>
    ));

    const input = getByTestId(el, "input");

    fire(input, "focus");
    tick();
    expect(input).toHaveAttribute(InputDataAttributes.focused);

    fire(input, "blur");
    tick();
    expect(input).toHaveAttribute(InputDataAttributes.touched);
    expect(input).not.toHaveAttribute(InputDataAttributes.focused);
  });
});
