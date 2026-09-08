import { type Accessor, createContext, useContext } from "solid-js";

import { EMPTY_OBJECT, NOOP } from "#utils/empty";

import type { FieldValidityData } from "../../field/root/FieldRoot";
import type { Form } from "../../form/Form";

export type Errors = Record<string, string | string[]>;

export interface FormField {
  name: string | undefined;
  validate: () => void;
  validityData: FieldValidityData;
  readonly controlElement: HTMLElement | null;
  getValue: () => unknown;
}

export interface FormContext {
  errors: Accessor<Errors>;
  clearErrors: (name: string | undefined) => void;
  readonly formElement: HTMLFormElement | null;
  fields: Map<string, FormField>;
  validationMode: Form.ValidationMode;
  submitCount: Accessor<number>;
}

export const FormContext = createContext<FormContext>({
  formElement: null,
  fields: new Map(),
  errors: () => EMPTY_OBJECT as Errors,
  clearErrors: NOOP,
  validationMode: "onSubmit",
  submitCount: () => 0,
});

export function useFormContext(): FormContext {
  return useContext(FormContext);
}
