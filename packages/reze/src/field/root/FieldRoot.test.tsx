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

function getInput(root: ParentNode): HTMLInputElement {
  const found = root.querySelector("input");
  if (!(found instanceof HTMLInputElement)) {
    throw new Error("input not found");
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

async function waitFor(assertion: () => void): Promise<void> {
  const deadline = Date.now() + 2000;
  for (;;) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() > deadline) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      tick();
    }
  }
}

describe("<Field.Root />", () => {
  it("renders a div element by default", () => {
    const { el } = mount(() => <Field.Root data-testid="root" />);

    expect(getByTestId(el, "root").tagName).toBe("DIV");
  });

  describe("prop: disabled", () => {
    it("should add data-disabled style hook to all components", () => {
      const { el } = mount(() => (
        <Field.Root disabled>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label">Label</Field.Label>
          <Field.Description data-testid="description">Description</Field.Description>
        </Field.Root>
      ));

      for (const part of ["control", "label", "description"]) {
        expect(getByTestId(el, part)).toHaveAttribute("data-disabled");
      }
      expect(getByTestId(el, "control")).toHaveAttribute("disabled");
    });

    it("keeps an explicitly invalid field marked invalid while disabled", () => {
      const validate = vi.fn();

      const { el } = mount(() => (
        <Field.Root invalid disabled validate={validate}>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      expect(getByTestId(el, "control")).toHaveAttribute("data-invalid", "");
    });

    it("updates the disabled state when the prop changes", () => {
      function Test() {
        let disabled = signal(false);
        return (
          <>
            <Field.Root disabled={() => disabled} data-testid="root">
              <Field.Control data-testid="control" />
            </Field.Root>
            <button onClick={() => (disabled = true)}>Disable</button>
          </>
        );
      }
      const { el } = mount(() => <Test />);

      expect(getByTestId(el, "root")).not.toHaveAttribute("data-disabled");

      fire(el.querySelector("button")!, "click");
      tick();

      expect(getByTestId(el, "root")).toHaveAttribute("data-disabled", "");
      expect(getByTestId(el, "control")).toHaveAttribute("disabled");
    });
  });

  describe("prop: validate", () => {
    it("when not in a form, the function does not run by default", () => {
      const validate = vi.fn(() => "error");

      mount(() => (
        <Field.Root validate={validate}>
          <Field.Control />
        </Field.Root>
      ));
      tick();

      expect(validate).not.toHaveBeenCalled();
    });

    it("applies aria-invalid to the control after failed validation", async () => {
      const { el } = mount(() => (
        <Form data-testid="form">
          <Field.Root name="test" validate={() => "error"} validationMode="onChange">
            <Field.Control data-testid="control" />
          </Field.Root>
        </Form>
      ));

      const control = getByTestId(el, "control");
      expect(control).not.toHaveAttribute("aria-invalid");

      changeValue(control as HTMLInputElement, "a");
      await flushMicrotasks();

      expect(control).toHaveAttribute("aria-invalid", "true");
    });

    it("receives all form values as the 2nd argument", async () => {
      const validate = vi.fn(() => null);

      const { el } = mount(() => (
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

      changeValue(getByTestId(el, "second") as HTMLInputElement, "hello");
      fire(getByTestId(el, "form"), "submit");
      tick();
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledWith("", { first: "", second: "hello" });
    });
  });

  describe("prop: validationMode", () => {
    describe("onSubmit", () => {
      it("should validate the field on submit", async () => {
        const { el } = mount(() => (
          <Form data-testid="form">
            <Field.Root validate={() => "error"}>
              <Field.Control />
              <Field.Error />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        expect(el.textContent).not.toContain("error");

        fire(getByTestId(el, "form"), "submit");
        tick();
        await flushMicrotasks();

        expect(el.textContent).toContain("error");
      });

      it("revalidates on change", async () => {
        const { el } = mount(() => (
          <Form data-testid="form">
            <Field.Root>
              <Field.Control type="url" required />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        const control = getInput(el);

        expect(el.querySelector('[data-testid="error"]')).toBe(null);

        fire(getByTestId(el, "form"), "submit");
        tick();
        await flushMicrotasks();
        expect(el.querySelector('[data-testid="error"]')).not.toBe(null);

        changeValue(control, "http://example");
        await waitFor(() => {
          expect(el.querySelector('[data-testid="error"]')).toBe(null);
        });
      });
    });

    describe("onChange", () => {
      it("validates the field on change", async () => {
        const { el } = mount(() => (
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

        const control = getInput(el);
        expect(el.textContent).not.toContain("error");

        changeValue(control, "t");
        await flushMicrotasks();

        expect(control).toHaveAttribute("data-invalid", "");
        expect(control).toHaveAttribute("aria-invalid", "true");
      });
    });

    describe("onBlur", () => {
      it("validates the field on blur", async () => {
        const { el } = mount(() => (
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

        const control = getInput(el);
        expect(el.textContent).not.toContain("error");

        // Focus first: a native blur() on an unfocused element fires no event.
        control.focus();
        tick();
        changeValue(control, "t");
        expect(control).not.toHaveAttribute("data-invalid");

        control.blur();
        tick();
        await flushMicrotasks();

        expect(control).toHaveAttribute("data-invalid", "");
        expect(control).toHaveAttribute("aria-invalid", "true");
      });

      it("should not mark invalid if `valueMissing` is the only error and not yet dirtied", async () => {
        const { el } = mount(() => (
          <Field.Root validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>
        ));

        const control = getByTestId(el, "control") as HTMLInputElement;

        control.focus();
        tick();
        control.blur();
        tick();
        await flushMicrotasks();

        expect(control).not.toHaveAttribute("data-invalid");
        expect(control).not.toHaveAttribute("aria-invalid");
      });

      it("should mark invalid if `valueMissing` is the only error and dirtied", async () => {
        const { el } = mount(() => (
          <Field.Root validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>
        ));

        const control = getByTestId(el, "control") as HTMLInputElement;

        control.focus();
        tick();
        changeValue(control, "a");
        changeValue(control, "");
        control.blur();
        tick();
        await flushMicrotasks();

        expect(control).toHaveAttribute("data-invalid", "");
        expect(control).toHaveAttribute("aria-invalid", "true");
      });

      it("supports async validation", async () => {
        const { el } = mount(() => (
          <Field.Root validationMode="onBlur" validate={() => Promise.resolve("error")}>
            <Field.Control />
            <Field.Error />
          </Field.Root>
        ));

        const control = getInput(el);
        expect(el.textContent).not.toContain("error");

        control.focus();
        tick();
        control.blur();
        tick();

        await waitFor(() => {
          expect(el.textContent).toContain("error");
        });
      });
    });
  });

  describe("computed validity state", () => {
    it("should not mark field as invalid for valueMissing if not dirty", async () => {
      const { el } = mount(() => (
        <Field.Root validationMode="onBlur">
          <Field.Control data-testid="control" required />
        </Field.Root>
      ));

      const control = getByTestId(el, "control") as HTMLInputElement;

      control.focus();
      tick();
      control.blur();
      tick();
      await flushMicrotasks();

      expect(control).toHaveAttribute("data-valid");
      expect(control).not.toHaveAttribute("data-invalid");
    });

    it("should mark field as invalid for other errors (e.g., typeMismatch) even if not dirty", async () => {
      const { el } = mount(() => (
        <Field.Root validationMode="onBlur">
          <Field.Control data-testid="control" required type="email" defaultValue="a@b@c" />
        </Field.Root>
      ));

      const control = getByTestId(el, "control") as HTMLInputElement;

      control.focus();
      tick();
      control.blur();
      tick();
      await flushMicrotasks();

      expect(control).toHaveAttribute("data-invalid", "");
    });
  });

  it("commits validation when Enter is pressed in the control", async () => {
    const validate = vi.fn(() => null);

    const { el } = mount(() => (
      <Form data-testid="form">
        <Field.Root validate={validate}>
          <Field.Control data-testid="control" />
        </Field.Root>
      </Form>
    ));

    fire(getByTestId(el, "control"), "keydown", { key: "Enter" } as KeyboardEventInit);
    tick();
    await flushMicrotasks();

    expect(validate).toHaveBeenCalledTimes(1);
  });

  describe("prop: actionsRef", () => {
    it("validates the field when the `validate` method is called", async () => {
      const validate = vi.fn(() => "error");
      let actions: Field.Root.Actions | null = null;

      mount(() => (
        <Field.Root
          validate={validate}
          actionsRef={(next) => {
            actions = next;
          }}
        >
          <Field.Control />
        </Field.Root>
      ));
      tick();

      actions!.validate();
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(1);
    });

    it("releases the actions ref when the field unmounts", () => {
      let actions: Field.Root.Actions | null = null;

      const { dispose } = mount(() => (
        <Field.Root
          actionsRef={(next) => {
            actions = next;
          }}
        >
          <Field.Control />
        </Field.Root>
      ));
      tick();

      expect(actions).not.toBeNull();

      dispose();
      tick();

      expect(actions).toBeNull();
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

      const { el } = mount(() => (
        <Field.Root data-testid="root" validationMode="onChange" validate={validate}>
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const root = getByTestId(el, "root");
      const control = getByTestId(el, "control") as HTMLInputElement;

      changeValue(control, "taken");
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(1);
      // Validity is unknown mid-flight: neutral, error hidden, flag raised.
      expect(root).not.toHaveAttribute("data-valid");
      expect(root).not.toHaveAttribute("data-invalid");
      expect(root).toHaveAttribute("data-validating");
      expect(control).not.toHaveAttribute("aria-invalid");
      expect(el.querySelector('[data-testid="error"]')).toBe(null);

      resolveValidate("Username is taken");
      await waitFor(() => {
        expect(root).toHaveAttribute("data-invalid", "");
      });

      expect(root).not.toHaveAttribute("data-validating");
      expect(control).toHaveAttribute("aria-invalid", "true");
      expect(getByTestId(el, "error")).toHaveTextContent("Username is taken");
    });

    it("retires a superseded async run without clearing the latest pending flag", async () => {
      const resolvers: Array<(value: string | null) => void> = [];
      const validate = vi.fn(
        () =>
          new Promise<string | null>((resolve) => {
            resolvers.push(resolve);
          }),
      );

      const { el } = mount(() => (
        <Field.Root data-testid="root" validationMode="onChange" validate={validate}>
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const root = getByTestId(el, "root");
      const control = getByTestId(el, "control") as HTMLInputElement;

      changeValue(control, "a");
      await flushMicrotasks();
      expect(root).toHaveAttribute("data-validating");

      changeValue(control, "ab");
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(2);
      expect(root).toHaveAttribute("data-validating");

      // The stale run resolves last: ignored, the latest run still owns the flag.
      resolvers[0]("stale error");
      await flushMicrotasks();
      expect(root).toHaveAttribute("data-validating");
      expect(root).not.toHaveAttribute("data-invalid");
      expect(el.querySelector('[data-testid="error"]')).toBe(null);

      resolvers[1](null);
      await waitFor(() => {
        expect(root).toHaveAttribute("data-valid", "");
      });
      expect(root).not.toHaveAttribute("data-validating");
    });
  });

  describe("prop: as", () => {
    it("renders the customized root element", () => {
      const { el } = mount(() => <Field.Root as="section" data-testid="root" />);

      expect(getByTestId(el, "root").tagName).toBe("SECTION");
    });
  });

  describe("prop: class", () => {
    it("applies the class when passed as a string", () => {
      const { el } = mount(() => <Field.Root class="test-class" data-testid="root" />);

      expect(getByTestId(el, "root").classList.contains("test-class")).toBe(true);
    });

    it("calls the class function with the component state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Field.Root
          disabled
          data-testid="root"
          class={(state) => {
            stateArgument = state;
            return "";
          }}
        />
      ));

      expect(getByTestId(el, "root")).toBeTruthy();
      expect(stateArgument).toEqual({
        disabled: true,
        touched: false,
        dirty: false,
        valid: null,
        filled: false,
        focused: false,
        validating: false,
      });
    });
  });

  describe("prop forwarding", () => {
    it("forwards custom props to the root element", () => {
      const { el } = mount(() => <Field.Root lang="fr" data-foobar="test-value" data-testid="root" />);

      const root = getByTestId(el, "root");
      expect(root.getAttribute("lang")).toBe("fr");
      expect(root.getAttribute("data-foobar")).toBe("test-value");
    });

    it("renders children defined as a function of state", () => {
      const { el } = mount(() => <Field.Root disabled>{(state) => (state.disabled ? "D" : "E")}</Field.Root>);

      expect(el.textContent).toBe("D");
    });

    it("keeps field context visible to render-prop children", () => {
      const { el } = mount(() => (
        <Field.Root>
          {() => (
            <Field.Control data-testid="control" />
          )}
        </Field.Root>
      ));

      // A zero-argument function passes through untouched; the control resolves
      // inside the field context and links up with the root.
      expect(getByTestId(el, "control").tagName).toBe("INPUT");
    });
  });

  describe("ref forwarding", () => {
    it("attaches a callback ref to the root element", () => {
      let instance: HTMLElement | null = null;
      const { el } = mount(() => (
        <Field.Root
          ref={(value: HTMLElement) => {
            instance = value;
          }}
        />
      ));

      expect(instance).toBe(el.querySelector("div"));
    });
  });

  it("throws when field parts are used outside the root", () => {
    expect(() =>
      mount(() => (
        <Show when={true}>
          <Field.Label>Label</Field.Label>
        </Show>
      )),
    ).toThrow("FieldRootContext is missing");
  });
});
