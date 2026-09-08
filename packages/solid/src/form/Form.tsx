import { createEffect, createMemo, createSignal, untrack } from "solid-js";

import { EMPTY_OBJECT } from "#utils/empty";

import { createGenericEventDetails, REASONS, type RebaseUIGenericEventDetails } from "../internals/event-details";
import { type Errors, FormContext, type FormField } from "../internals/form-context";
import { RenderElement } from "../internals/render-element";
import { split } from "../internals/split";
import type { RebaseUIComponentProps } from "../internals/types";

/**
 * A native form element with consolidated error handling.
 * Renders a `<form>` element.
 *
 * Documentation: [Rebase UI Form](https://rebase-ui.knst.dev/components/form)
 */
export function Form<FormValues extends Record<string, any> = Record<string, any>>(props: Form.Props<FormValues>) {
  const [local, elementProps] = split(props as Form.Props<FormValues>, { default: defaultProps }, [
    "as",
    "actions",
    "errors",
    "onFormSubmit",
    "onSubmit",
    "validationMode",
  ]);

  const as = untrack(() => local.as);

  const fields = new Map<string, FormField>();

  let formElement: HTMLFormElement | null = null;
  let submitted = false;

  const [submitCount, setSubmitCount] = createSignal(0);
  const [errors, setErrors] = createSignal<Errors | undefined>(untrack(() => local.errors));

  createEffect(
    () => local.errors,
    (externalErrors) => {
      setErrors(externalErrors);
    },
  );

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

  createEffect(
    () => errors(),
    () => {
      if (!submitted) {
        return;
      }
      submitted = false;
      focusFirstInvalid();
    },
  );

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

  createEffect(
    () => local.actions,
    (actions) => {
      if (actions) {
        actions = { validate };
      }
    },
  );

  const clearErrors = (name: string | undefined) => {
    if (!name) {
      return;
    }

    setErrors((prev) => {
      if (!prev || !Object.hasOwn(prev, name)) {
        return prev;
      }
      const nextErrors = { ...prev };
      delete nextErrors[name];
      return nextErrors;
    });
  };

  const handleSubmit = (event: SubmitEvent) => {
    setSubmitCount((prev) => prev + 1);

    fields.forEach((field) => {
      field.validate();
    });
    if (focusFirstInvalid()) {
      event.preventDefault();
      return;
    }

    submitted = true;

    (local.onSubmit as ((event: SubmitEvent) => void) | undefined)?.(event);

    if (local.onFormSubmit) {
      event.preventDefault();

      const formValues = {} as Record<string, any>;
      fields.forEach((field) => {
        if (field.name) {
          formValues[field.name] = field.getValue();
        }
      });

      local.onFormSubmit(formValues as FormValues, createGenericEventDetails(REASONS.none, event));
    }
  };

  const formProps = (externalProps: Record<string, any>): Record<string, any> => {
    const target: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "onSubmit") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    target.noValidate = true;
    target.onSubmit = handleSubmit;

    return target;
  };

  const contextValue: FormContext = {
    errors: createMemo(() => errors() ?? (EMPTY_OBJECT as Errors)),
    clearErrors,
    get formElement() {
      return formElement;
    },
    fields,
    validationMode: local.validationMode,
    submitCount,
  };

  return (
    <FormContext value={contextValue}>
      <RenderElement
        as={as}
        props={[
          elementProps,
          formProps,
          {
            ref: (element: HTMLFormElement) => {
              formElement = element;
            },
          },
        ]}
      />
    </FormContext>
  );
}

const defaultProps = Object.freeze({
  as: "form",
  validationMode: "onSubmit",
} satisfies Partial<Form.Props>);

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
   * A ref to imperative actions.
   * - `validate`: Validates all fields when called. Optionally pass a field name to validate a single field.
   */
  actions?: Form.Actions | undefined;
}

export type FormProps<FormValues extends Record<string, any> = Record<string, any>> = FormOwnProps<FormValues> &
  RebaseUIComponentProps<"form", FormState>;

export namespace Form {
  export type Props<FormValues extends Record<string, any> = Record<string, any>> = FormProps<FormValues>;
  export type OwnProps<FormValues extends Record<string, any> = Record<string, any>> = FormOwnProps<FormValues>;
  export type State = FormState;
  export type Actions = FormActions;
  export type ValidationMode = FormValidationMode;
  export type SubmitEventReason = FormSubmitEventReason;
  export type SubmitEventDetails = FormSubmitEventDetails;

  export type Values<FormValues extends Record<string, any> = Record<string, any>> = FormValues;
}
