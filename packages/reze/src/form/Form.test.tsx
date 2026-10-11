import { cleanup, fire, mount, tick } from "@rezejs/testing-library";
import { onCleanup, signal } from "reze-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { useFormContext, type Errors, type FormContext, type FormField } from "../internals/form-context/FormContext";
import { Form } from "./Form";

afterEach(cleanup);

interface MockFieldProps {
  name: string | undefined;
  value?: unknown;
  valid?: boolean | null;
  validate?: () => void;
  onRegister?: (field: FormField) => void;
  inputTestId?: string;
}

let mockFieldId = 0;

/**
 * Minimal stand-in for `<Field.Root>` + `<Field.Control>`: registers a mock
 * field in the form context and renders a focusable input as its control.
 */
function MockField(props: MockFieldProps) {
  const form = useFormContext();
  const testId = props.inputTestId ?? `mock-control-${mockFieldId}`;
  let input: HTMLInputElement | undefined;

  const field: FormField = {
    name: props.name,
    validate: () => props.validate?.(),
    validityData: {
      state: {
        badInput: false,
        customError: false,
        patternMismatch: false,
        rangeOverflow: false,
        rangeUnderflow: false,
        stepMismatch: false,
        tooLong: false,
        tooShort: false,
        typeMismatch: false,
        valueMissing: false,
        valid: props.valid ?? null,
      },
      error: "",
      errors: [],
    },
    get controlElement() {
      return input ?? null;
    },
    getValue: () => props.value,
  };

  const id = `mock-field-${mockFieldId++}`;
  form.fields.set(id, field);
  onCleanup(() => {
    form.fields.delete(id);
  });

  props.onRegister?.(field);

  return (
    <input
      data-testid={testId}
      ref={(element: HTMLInputElement) => {
        input = element;
      }}
    />
  );
}

function getForm(root: ParentNode): HTMLFormElement {
  const found = root.querySelector("form");
  if (!(found instanceof HTMLFormElement)) {
    throw new Error("form not found");
  }
  return found;
}

function getByTestId(root: ParentNode, testId: string): HTMLElement {
  const found = root.querySelector(`[data-testid="${testId}"]`);
  if (!(found instanceof HTMLElement)) {
    throw new Error(`element with data-testid "${testId}" not found`);
  }
  return found;
}

describe("<Form />", () => {
  it("renders a form element with novalidate by default", () => {
    const { el } = mount(() => <Form data-testid="form" />);

    const form = getForm(el);
    expect(form.getAttribute("data-testid")).toBe("form");
    expect(form.hasAttribute("novalidate")).toBe(true);
  });

  it("forwards custom props to the form element", () => {
    const { el } = mount(() => <Form lang="fr" data-foobar="test-value" />);

    const form = getForm(el);
    expect(form.getAttribute("lang")).toBe("fr");
    expect(form.getAttribute("data-foobar")).toBe("test-value");
  });

  it("attaches a callback ref to the form element", () => {
    let instance: HTMLFormElement | null = null;
    const { el } = mount(() => (
      <Form
        ref={(element: HTMLFormElement) => {
          instance = element;
        }}
      />
    ));

    expect(instance).toBe(getForm(el));
  });

  it("exposes the form element through context", () => {
    let captured: FormContext | undefined;
    function Capture() {
      captured = useFormContext();
      return null;
    }

    const { el } = mount(() => (
      <Form>
        <Capture />
      </Form>
    ));

    expect(captured!.formElement).toBe(getForm(el));
  });

  it("provides default context outside a form", () => {
    let captured: FormContext | undefined;
    function Capture() {
      captured = useFormContext();
      return null;
    }

    mount(() => <Capture />);

    expect(captured!.errors()).toEqual({});
    expect(captured!.validationMode).toBe("onSubmit");
    expect(captured!.submitCount()).toBe(0);
    expect(captured!.formElement).toBeNull();
  });

  it("submits values through onFormSubmit when valid", () => {
    const submitSpy = vi.fn();
    const { el } = mount(() => (
      <Form data-testid="form" onFormSubmit={submitSpy}>
        <MockField name="username" value="alice132" />
        <button type="submit">submit</button>
      </Form>
    ));

    const dispatched = fire(getByTestId(el, "form"), "submit");

    expect(dispatched).toBe(false);
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy.mock.calls[0][0]).toEqual({ username: "alice132" });
    expect(submitSpy.mock.calls[0][1].reason).toBe("none");
  });

  it("does not submit if there are errors", () => {
    const submitSpy = vi.fn();
    const validate = vi.fn();
    const { el } = mount(() => (
      <Form data-testid="form" onSubmit={submitSpy}>
        <MockField name="username" valid={false} validate={validate} />
        <button type="submit">submit</button>
      </Form>
    ));

    const dispatched = fire(getByTestId(el, "form"), "submit");

    expect(dispatched).toBe(false);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("does not run onFormSubmit when the form is invalid", () => {
    const submitSpy = vi.fn();
    const { el } = mount(() => (
      <Form data-testid="form" onFormSubmit={submitSpy}>
        <MockField name="username" valid={false} />
        <button type="submit">submit</button>
      </Form>
    ));

    fire(getByTestId(el, "form"), "submit");

    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("lets valid native submits proceed without onFormSubmit", () => {
    const submitSpy = vi.fn();
    const { el } = mount(() => (
      <Form data-testid="form" onSubmit={submitSpy}>
        <MockField name="username" value="alice" />
      </Form>
    ));

    const dispatched = fire(getByTestId(el, "form"), "submit");

    expect(dispatched).toBe(true);
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("focuses the first invalid field on submit", () => {
    const { el } = mount(() => (
      <Form data-testid="form">
        <MockField name="one" valid={false} inputTestId="first" />
        <MockField name="two" valid={false} inputTestId="second" />
        <button type="submit">submit</button>
      </Form>
    ));

    fire(getByTestId(el, "form"), "submit");

    expect(document.activeElement).toBe(getByTestId(el, "first"));
  });

  it("increments submitCount on submit and exposes it synchronously during validation", () => {
    const seen: number[] = [];
    let captured: FormContext | undefined;
    function Capture() {
      captured = useFormContext();
      return null;
    }

    const { el } = mount(() => (
      <Form data-testid="form">
        <Capture />
        <MockField
          name="username"
          value="alice"
          validate={() => {
            seen.push(captured!.submitCount());
          }}
        />
      </Form>
    ));

    const form = getByTestId(el, "form");
    expect(captured!.submitCount()).toBe(0);

    fire(form, "submit");
    expect(seen).toEqual([1]);
    expect(captured!.submitCount()).toBe(1);

    fire(form, "submit");
    expect(seen).toEqual([1, 2]);
    expect(captured!.submitCount()).toBe(2);
  });

  it("exposes errors from the errors prop and clears them field by field", () => {
    let captured: FormContext | undefined;
    function Capture() {
      captured = useFormContext();
      return null;
    }
    function ErrorsView() {
      const form = useFormContext();
      return <output data-testid="errors">{JSON.stringify(form.errors())}</output>;
    }

    const { el } = mount(() => (
      <Form errors={{ foo: "bar" }}>
        <Capture />
        <ErrorsView />
      </Form>
    ));
    tick();

    expect(getByTestId(el, "errors").textContent).toBe(JSON.stringify({ foo: "bar" }));

    captured!.clearErrors("foo");
    tick();

    expect(getByTestId(el, "errors").textContent).toBe(JSON.stringify({}));

    const before = captured!.errors();
    captured!.clearErrors("missing");
    captured!.clearErrors(undefined);
    tick();

    expect(captured!.errors()).toBe(before);
  });

  it("updates errors when the errors prop changes", () => {
    function ErrorsView() {
      const form = useFormContext();
      return <output data-testid="errors">{JSON.stringify(form.errors())}</output>;
    }
    function Test() {
      let serverErrors: Errors = signal({ foo: "bar" });
      return (
        <>
          <Form errors={serverErrors}>
            <ErrorsView />
          </Form>
          <button
            data-testid="clear"
            onClick={() => {
              serverErrors = {};
            }}
          >
            Clear
          </button>
        </>
      );
    }

    const { el } = mount(() => <Test />);
    tick();
    expect(getByTestId(el, "errors").textContent).toBe(JSON.stringify({ foo: "bar" }));

    fire(getByTestId(el, "clear"), "click");
    tick();

    expect(getByTestId(el, "errors").textContent).toBe(JSON.stringify({}));
  });

  describe("prop: as", () => {
    it("renders the customized root element", () => {
      const { el } = mount(() => <Form as="div" data-testid="form" />);

      const root = getByTestId(el, "form");
      expect(root.tagName).toBe("DIV");
      expect(root.hasAttribute("novalidate")).toBe(true);
    });
  });

  describe("prop: validationMode", () => {
    function captureValidationMode(validationMode: Form.ValidationMode | undefined): Form.ValidationMode {
      let captured: FormContext | undefined;
      function Capture() {
        captured = useFormContext();
        return null;
      }

      mount(() => (
        <Form validationMode={validationMode}>
          <Capture />
        </Form>
      ));

      return captured!.validationMode;
    }

    it("defaults to onSubmit", () => {
      expect(captureValidationMode(undefined)).toBe("onSubmit");
    });

    it("passes the configured mode through context", () => {
      expect(captureValidationMode("onBlur")).toBe("onBlur");
      expect(captureValidationMode("onChange")).toBe("onChange");
    });
  });

  describe("prop: actionsRef", () => {
    it("validates all fields when validate is called", () => {
      const validateFirst = vi.fn();
      const validateSecond = vi.fn();
      let capturedActions: Form.Actions | null = null;

      mount(() => (
        <Form
          actionsRef={(next) => {
            capturedActions = next;
          }}
        >
          <MockField name="first" validate={validateFirst} />
          <MockField name="second" validate={validateSecond} />
        </Form>
      ));
      tick();

      expect(capturedActions).not.toBeNull();
      expect(validateFirst).not.toHaveBeenCalled();

      capturedActions!.validate();

      expect(validateFirst).toHaveBeenCalledTimes(1);
      expect(validateSecond).toHaveBeenCalledTimes(1);
    });

    it("validates a single field by name", () => {
      const validateFirst = vi.fn();
      const validateSecond = vi.fn();
      let capturedActions: Form.Actions | null = null;

      mount(() => (
        <Form
          actionsRef={(next) => {
            capturedActions = next;
          }}
        >
          <MockField name="first" validate={validateFirst} />
          <MockField name="second" validate={validateSecond} />
        </Form>
      ));
      tick();

      capturedActions!.validate("second");

      expect(validateFirst).not.toHaveBeenCalled();
      expect(validateSecond).toHaveBeenCalledTimes(1);
    });

    it("releases the actions ref when the form unmounts", () => {
      let capturedActions: Form.Actions | null = null;

      const { dispose } = mount(() => (
        <Form
          actionsRef={(next) => {
            capturedActions = next;
          }}
        >
          <MockField name="test" />
        </Form>
      ));
      tick();

      expect(capturedActions).not.toBeNull();

      dispose();
      tick();

      expect(capturedActions).toBeNull();
    });
  });

  describe("render props", () => {
    it("calls the class function with the form state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Form
          data-testid="form"
          class={(state) => {
            stateArgument = state;
            return "custom";
          }}
        />
      ));

      expect(getByTestId(el, "form").classList.contains("custom")).toBe(true);
      expect(stateArgument).toEqual({});
    });

    it("forwards the style prop defined as a function of state", () => {
      let stateArgument: unknown;
      const { el } = mount(() => (
        <Form
          data-testid="form"
          style={(state) => {
            stateArgument = state;
            return { color: "green" };
          }}
        />
      ));

      expect(getByTestId(el, "form").style.color).toBe("green");
      expect(stateArgument).toEqual({});
    });

    it("renders children defined as a function of state", () => {
      const { el } = mount(() => <Form data-testid="form">{(state) => (Object.keys(state).length === 0 ? "empty-state" : "other")}</Form>);

      expect(getByTestId(el, "form").textContent).toBe("empty-state");
    });
  });
});
