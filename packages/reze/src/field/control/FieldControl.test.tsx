import "@testing-library/jest-dom/vitest";
import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { Show, signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

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

function changeValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  fire(input, "change");
  tick();
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
  tick();
}

describe("<Field.Control />", () => {
  it("renders a native input inside the field", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Control data-testid="control" />
      </Field.Root>
    ));

    expect(getByTestId(el, "control").tagName).toBe("INPUT");
  });

  it("renders the customized control element", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Control as="textarea" data-testid="control" />
      </Field.Root>
    ));

    expect(getByTestId(el, "control").tagName).toBe("TEXTAREA");
  });

  it("attaches a callback ref to the control element", () => {
    let instance: HTMLElement | null = null;
    const { el } = mount(() => (
      <Field.Root>
        <Field.Control
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        />
      </Field.Root>
    ));

    expect(instance).toBe(el.querySelector("input"));
    expect(instance).toBeInstanceOf(window.HTMLInputElement);
  });

  it("validates once when changed by the user", async () => {
    const validate = vi.fn();

    const { el } = mount(() => (
      <Field.Root validationMode="onChange" validate={validate}>
        <Field.Control />
      </Field.Root>
    ));

    changeValue(el.querySelector("input") as HTMLInputElement, "a");
    await flushMicrotasks();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.lastCall?.[0]).toBe("a");
  });

  it("calls onValueChange with the new value", async () => {
    const onValueChange = vi.fn();

    const { el } = mount(() => (
      <Field.Root validationMode="onChange">
        <Field.Control onValueChange={onValueChange} />
      </Field.Root>
    ));

    changeValue(el.querySelector("input") as HTMLInputElement, "abc");
    await flushMicrotasks();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.lastCall?.[0]).toBe("abc");
  });

  it("shows a required error when a prefilled value is cleared", async () => {
    const onValueChange = vi.fn();
    const { el } = mount(() => (
      <Field.Root validationMode="onChange">
        <Field.Control data-testid="control" defaultValue="value" required onValueChange={onValueChange} />
        <Field.Error match="valueMissing">Required</Field.Error>
      </Field.Root>
    ));

    const control = getByTestId(el, "control") as HTMLInputElement;

    changeValue(control, "");
    expect(onValueChange).toHaveBeenCalledWith("", expect.anything());
    await flushMicrotasks();

    // The control node stays stable while the error mounts beside it.
    expect(el.querySelector('[data-testid="control"]')).toBe(control);
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(el.textContent).toContain("Required");
  });

  it("marks filled when a value is present", () => {
    const { el } = mount(() => (
      <Field.Root>
        <Field.Control data-testid="control" defaultValue="value" />
      </Field.Root>
    ));

    expect(getByTestId(el, "control")).toHaveAttribute("data-filled");
  });

  it("commits on Enter keydown", async () => {
    const validate = vi.fn(() => null);

    const { el } = mount(() => (
      <Form>
        <Field.Root validate={validate}>
          <Field.Control />
        </Field.Root>
      </Form>
    ));

    fire(el.querySelector("input") as HTMLInputElement, "keydown", { key: "Enter" } as KeyboardEventInit);
    tick();
    await flushMicrotasks();

    expect(validate).toHaveBeenCalledTimes(1);
  });

  describe("[data-focused]", () => {
    it("is removed when the focused control becomes disabled", () => {
      function Test() {
        let disabled = signal(false);
        return (
          <Field.Root data-testid="root">
            <Field.Label data-testid="label">Name</Field.Label>
            <Field.Control data-testid="first" disabled={disabled} />
            <button data-testid="toggle" onClick={() => (disabled = true)}>
              Disable
            </button>
          </Field.Root>
        );
      }
      const { el } = mount(() => <Test />);

      const control = getByTestId(el, "first");
      control.focus();
      tick();

      expect(getByTestId(el, "root")).toHaveAttribute("data-focused", "");
      expect(control).toHaveAttribute("data-focused", "");

      fire(getByTestId(el, "toggle"), "click");
      tick();

      expect(getByTestId(el, "root")).not.toHaveAttribute("data-focused");
      expect(getByTestId(el, "first")).not.toHaveAttribute("data-focused");
      expect(getByTestId(el, "label")).not.toHaveAttribute("data-focused");
    });

    it("is removed when the field root becomes disabled", () => {
      function Test() {
        let disabled = signal(false);
        return (
          <Field.Root data-testid="root" disabled={() => disabled}>
            <Field.Control data-testid="control" />
            <button data-testid="toggle" onClick={() => (disabled = true)}>
              Disable
            </button>
          </Field.Root>
        );
      }
      const { el } = mount(() => <Test />);

      getByTestId(el, "control").focus();
      tick();
      expect(getByTestId(el, "root")).toHaveAttribute("data-focused", "");

      fire(getByTestId(el, "toggle"), "click");
      tick();

      expect(getByTestId(el, "root")).not.toHaveAttribute("data-focused");
    });

    it("can be re-acquired after the control is re-enabled", () => {
      function Test() {
        let disabled = signal(false);
        return (
          <>
            <Field.Root data-testid="root">
              <Field.Control data-testid="first" disabled={disabled} />
            </Field.Root>
            <button type="button" data-testid="outside" onClick={() => (disabled = !disabled)}>
              Toggle
            </button>
          </>
        );
      }
      const { el } = mount(() => <Test />);

      const control = getByTestId(el, "first");
      control.focus();
      tick();
      expect(getByTestId(el, "root")).toHaveAttribute("data-focused", "");

      fire(getByTestId(el, "outside"), "click");
      tick();
      expect(getByTestId(el, "root")).not.toHaveAttribute("data-focused");

      // Browsers move focus off a disabled control; happy-dom leaves it as the active element.
      getByTestId(el, "outside").focus();
      tick();

      fire(getByTestId(el, "outside"), "click");
      tick();
      expect(getByTestId(el, "root")).not.toHaveAttribute("data-focused");

      getByTestId(el, "first").focus();
      tick();
      expect(getByTestId(el, "root")).toHaveAttribute("data-focused", "");
    });

    it("is removed when the focused control unmounts", () => {
      function Test() {
        let mounted = signal(true);
        return (
          <Field.Root data-testid="root">
            <Field.Label data-testid="label">Name</Field.Label>
            <Show when={mounted}>
              <Field.Control data-testid="first" />
            </Show>
            <button data-testid="toggle" onClick={() => (mounted = false)}>
              Unmount
            </button>
          </Field.Root>
        );
      }
      const { el } = mount(() => <Test />);

      getByTestId(el, "first").focus();
      tick();

      expect(getByTestId(el, "root")).toHaveAttribute("data-focused", "");

      fire(getByTestId(el, "toggle"), "click");
      tick();

      expect(getByTestId(el, "root")).not.toHaveAttribute("data-focused");
      expect(getByTestId(el, "label")).not.toHaveAttribute("data-focused");
    });
  });

  describe("defaultValue", () => {
    it("forwards a changing defaultValue and resyncs the filled state", () => {
      function Test() {
        let defaultValue: string = signal("");
        return (
          <Field.Root data-testid="root">
            <Field.Control defaultValue={defaultValue} />
            <button data-testid="set-value" onClick={() => (defaultValue = "value")}>
              Set
            </button>
            <button data-testid="clear-value" onClick={() => (defaultValue = "")}>
              Clear
            </button>
          </Field.Root>
        );
      }
      const { el } = mount(() => <Test />);

      const root = getByTestId(el, "root");
      expect(root).not.toHaveAttribute("data-filled");

      fire(getByTestId(el, "set-value"), "click");
      tick();

      expect(el.querySelector("input")).toHaveValue("value");
      expect(root).toHaveAttribute("data-filled", "");

      fire(getByTestId(el, "clear-value"), "click");
      tick();

      expect(el.querySelector("input")).toHaveValue("");
      expect(root).not.toHaveAttribute("data-filled");
    });

    it("keeps filled state from the edited value when defaultValue changes", async () => {
      function Test() {
        let defaultValue: string = signal("");
        return (
          <Field.Root data-testid="root">
            <Field.Control defaultValue={defaultValue} />
            <button data-testid="set-next" onClick={() => (defaultValue = "next")}>
              Next
            </button>
            <button data-testid="clear-value" onClick={() => (defaultValue = "")}>
              Clear
            </button>
          </Field.Root>
        );
      }
      const { el } = mount(() => <Test />);

      const root = getByTestId(el, "root");
      const input = el.querySelector("input") as HTMLInputElement;
      changeValue(input, "typed");
      await flushMicrotasks();
      expect(root).toHaveAttribute("data-filled", "");

      fire(getByTestId(el, "set-next"), "click");
      tick();
      fire(getByTestId(el, "clear-value"), "click");
      tick();

      expect(input).toHaveValue("typed");
      expect(root).toHaveAttribute("data-filled", "");
    });
  });
});
