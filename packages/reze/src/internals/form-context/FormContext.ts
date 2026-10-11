import { createContext, useContext } from "reze-js";

import type { Form } from "../../form/Form";

export type Errors = Record<string, string | string[]>;

/**
 * Validity snapshot of a field registered in the form. Mirrors the field's own
 * validity data structurally; the field package owns the runtime shape.
 */
export interface FormFieldValidityData {
  state: {
    badInput: boolean;
    customError: boolean;
    patternMismatch: boolean;
    rangeOverflow: boolean;
    rangeUnderflow: boolean;
    stepMismatch: boolean;
    tooLong: boolean;
    tooShort: boolean;
    typeMismatch: boolean;
    valueMissing: boolean;
    valid: boolean | null;
  };
  error: string;
  errors: string[];
}

export interface FormField {
  name: string | undefined;
  validate: () => void;
  validityData: FormFieldValidityData;
  readonly controlElement: HTMLElement | null;
  getValue: () => unknown;
}

export interface FormContext {
  errors: () => Errors;
  clearErrors: (name: string | undefined) => void;
  readonly formElement: HTMLFormElement | null;
  fields: Map<string, FormField>;
  validationMode: Form.ValidationMode;
  submitCount: () => number;
}

const EMPTY_ERRORS: Errors = Object.freeze({});

function noop(): void {}

export const FormContext = createContext<FormContext>({
  formElement: null,
  fields: new Map(),
  errors: () => EMPTY_ERRORS,
  clearErrors: noop,
  validationMode: "onSubmit",
  submitCount: () => 0,
});

export function useFormContext(): FormContext {
  return useContext(FormContext);
}
