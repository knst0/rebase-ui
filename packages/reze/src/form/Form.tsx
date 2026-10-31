import { dynamicElement, effect, omitProps, onCleanup, store, untrack, type JSX } from "reze-js";

import { createGenericEventDetails, REASONS, type RebaseUIGenericEventDetails } from "../internals/event-details";
import { FormContext, type Errors, type FormField } from "../internals/form-context/FormContext";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../internals/types";

const EMPTY_ERRORS: Errors = Object.freeze({});

/**
 * A native form element with consolidated error handling.
 * Renders a `<form>` element.
 *
 * Documentation: [Rebase UI Form](https://rebase-ui.knst.dev/components/form)
 */
export function Form<FormValues extends Record<string, any> = Record<string, any>, T extends JSX.ElementType = "form">(
  props: Form.Props<FormValues, T>,
) {
  const rest = omitProps(
    props,
    "as",
    "actionsRef",
    "errors",
    "onFormSubmit",
    "onSubmit",
    "validationMode",
    "class",
    "style",
    "children",
    "ref",
  );
  // Never read `props.children` here: the getter instantiates child components
  // eagerly, which would place them outside the form context below. It is
  // passed through to <FormContent> instead, which reads it inside the provider.
  // Store writes land in place and notify immediately, so no separate plain
  // counter is needed: validation triggered by submit already observes the
  // incremented count synchronously.
  const state = store({
    errors: untrack(() => props.errors),
    submitCount: 0,
  });

  const fields = new Map<string, FormField>();

  let formElement: HTMLFormElement | null = null;
  let submitted = false;

  effect(() => {
    state.errors = props.errors;
  });

  function comesBeforeInSameTree(element: Node, reference: Node) {
    const position = element.compareDocumentPosition(reference);
    return (position & Node.DOCUMENT_POSITION_DISCONNECTED) === 0 && (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }

  const focusFirstInvalid = () => {
    let hasInvalid = false;
    let firstControl: HTMLElement | null = null;
    for (const field of fields.values()) {
      if (field.validityData.state.valid !== false) {
        continue;
      }
      hasInvalid = true;
      const control = field.controlElement;
      if (control && (!firstControl || comesBeforeInSameTree(control, firstControl))) {
        firstControl = control;
      }
    }
    if (firstControl) {
      firstControl.focus();
      if (firstControl.tagName === "INPUT") {
        (firstControl as HTMLInputElement).select();
      }
      return true;
    }
    return hasInvalid;
  };

  effect(() => {
    // Subscribe to error updates: async errors (e.g. from a server action)
    // arrive through the `errors` prop after the submit already happened.
    void state.errors;
    if (!submitted) {
      return;
    }
    submitted = false;
    focusFirstInvalid();
  });

  const validate = (fieldName?: string) => {
    if (fieldName) {
      Array.from(fields.values())
        .find((field) => field.name === fieldName)
        ?.validate();
    } else {
      fields.forEach((field) => {
        field.validate();
      });
    }
  };

  effect(() => {
    const actionsRef = props.actionsRef;
    if (!actionsRef) {
      return;
    }

    actionsRef({ validate });

    onCleanup(() => {
      actionsRef(null);
    });
  });

  function errors(): Errors {
    return state.errors ?? EMPTY_ERRORS;
  }

  function submitCount(): number {
    return state.submitCount;
  }

  const clearErrors = (name: string | undefined) => {
    if (!name) {
      return;
    }

    // Actions never subscribe: read the previous errors untracked so a call
    // from a reactive scope does not subscribe the caller to what it writes.
    const prev = untrack(() => state.errors);
    if (!prev || !Object.hasOwn(prev, name)) {
      return;
    }
    const nextErrors = { ...prev };
    delete nextErrors[name];
    state.errors = nextErrors;
  };

  const handleSubmit = (event: SubmitEvent) => {
    state.submitCount = state.submitCount + 1;

    fields.forEach((field) => {
      field.validate();
    });
    if (focusFirstInvalid()) {
      event.preventDefault();
      return;
    }

    submitted = true;

    props.onSubmit?.(event);

    if (props.onFormSubmit) {
      event.preventDefault();

      const formValues = {} as Record<string, any>;
      fields.forEach((field) => {
        if (field.name) {
          formValues[field.name] = field.getValue();
        }
      });

      props.onFormSubmit(formValues as FormValues, createGenericEventDetails(REASONS.none, event));
    }
  };

  const formRef = (element: HTMLFormElement | null) => {
    formElement = element;
    const ref = props.ref;
    if (typeof ref === "function") {
      untrack(ref, element);
    }
  };

  const contextValue: FormContext = {
    errors,
    clearErrors,
    get formElement() {
      return formElement;
    },
    fields,
    validationMode: props.validationMode ?? "onSubmit",
    submitCount,
  };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "form");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the form parts without context. Children
  // resolve in FormContent below so they are created inside the provider.
  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      novalidate
      onSubmit={handleSubmit}
      class={resolveClassValue(props.class, {})}
      style={resolveStyleValue(props.style, {})}
      ref={formRef as (element: HTMLElement | null) => void}
    >
      <FormContext value={contextValue}>
        <FormContent>{props.children}</FormContent>
      </FormContext>
    </Tag>
  );
}

/**
 * Renders the form children inside the form context. Reads `props.children`
 * here — rather than in `Form` — so child components instantiate under the
 * provider above and see the form's fields, errors, and actions.
 */
export function FormContent(props: { children: ChildrenValue<FormState> | undefined }) {
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  return resolveChildrenValue(children, () => ({}));
}

export type FormSubmitEventReason = typeof REASONS.none;
export type FormSubmitEventDetails = RebaseUIGenericEventDetails<FormSubmitEventReason>;

export type FormValidationMode = "onSubmit" | "onBlur" | "onChange";

export interface FormActions {
  validate: (fieldName?: string) => void;
}

export interface FormState {}

export interface FormOwnProps<FormValues extends Record<string, any> = Record<string, any>> {
  /**
   * Determines when the form should be validated.
   * The `validationMode` prop on `<Field.Root>` takes precedence over this.
   *
   * - `onSubmit` (default): validates the field when the form is submitted, afterwards fields will re-validate on change.
   * - `onBlur`: validates a field when it loses focus.
   * - `onChange`: validates the field on every change to its value.
   *
   * @default 'onSubmit'
   */
  validationMode?: Form.ValidationMode | undefined;
  /**
   * Validation errors returned externally, typically after submission by a server or a form action.
   * This should be an object where keys correspond to the `name` attribute on `<Field.Root>`,
   * and values correspond to error(s) related to that field.
   */
  errors?: Errors | undefined;
  /**
   * Event handler called when the form is submitted.
   * `preventDefault()` is called on the native submit event when used.
   */
  onFormSubmit?: ((formValues: FormValues, eventDetails: Form.SubmitEventDetails) => void) | undefined;
  /**
   * A callback that receives the imperative actions.
   * - `validate`: Validates all fields when called. Optionally pass a field name to validate a single field.
   */
  actionsRef?: ((actions: Form.Actions | null) => void) | undefined;
  /**
   * Event handler called when a valid form is submitted natively.
   * Not called when validation fails; prefer `onFormSubmit` to receive the form values.
   */
  onSubmit?: ((event: SubmitEvent) => void) | undefined;
}

export type FormProps<
  FormValues extends Record<string, any> = Record<string, any>,
  T extends JSX.ElementType = "form",
> = FormOwnProps<FormValues> & Omit<RebaseUIComponentProps<T, FormState>, "onSubmit">;

export namespace Form {
  export type Props<FormValues extends Record<string, any> = Record<string, any>, T extends JSX.ElementType = "form"> = FormProps<
    FormValues,
    T
  >;
  export type OwnProps<FormValues extends Record<string, any> = Record<string, any>> = FormOwnProps<FormValues>;
  export type State = FormState;
  export type Actions = FormActions;
  export type ValidationMode = FormValidationMode;
  export type SubmitEventReason = FormSubmitEventReason;
  export type SubmitEventDetails = FormSubmitEventDetails;

  export type Values<FormValues extends Record<string, any> = Record<string, any>> = FormValues;
}
