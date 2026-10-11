import { createContext, useContext } from "reze-js";

import type { CreateFieldValidationReturnValue } from "../../field/root/createFieldValidation";
import type { FieldValidityData, FieldValiditySetter } from "../../field/root/FieldRoot";
import type { Form } from "../../form/Form";
import {
  DEFAULT_FIELD_ROOT_STATE,
  DEFAULT_VALIDITY_STATE,
  type FieldRootStateSelectors,
} from "../field-constants";
import type { FieldControlRegistration } from "../field-register-control/createFieldControlRegistration";

export interface FieldRootContext {
  invalid: () => boolean | undefined;
  name: () => string | undefined;
  validityData: FieldValidityData;
  setValidityData: FieldValiditySetter;
  disabled: () => boolean | undefined;
  setTouched: (value: boolean) => void;
  setDirty: (value: boolean) => void;
  setFilled: (value: boolean) => void;
  setFocused: (value: boolean) => void;
  /**
   * Identifies the control the focused state belongs to, so that disabling or unmounting a
   * different control in the same field can't clear it. Written through `createSetFieldFocused`.
   */
  getFocusOwner: () => unknown;
  setFocusOwner: (owner: unknown) => void;
  validationMode: Form.ValidationMode;
  shouldValidateOnChange: () => boolean;
  state: FieldRootStateSelectors;
  registerFieldControl: (source: object, registration: FieldControlRegistration | undefined) => void;
  validation: CreateFieldValidationReturnValue;
}

const DEFAULT_VALIDITY_DATA: FieldValidityData = {
  state: DEFAULT_VALIDITY_STATE,
  errors: [],
  error: "",
  value: "",
  initialValue: null,
  isValidating: false,
};

function noop(): void {}

const NOOP_VALIDITY_SETTER: FieldValiditySetter = noop as FieldValiditySetter;

const EMPTY_OBJECT: Record<string, any> = {};

export const DEFAULT_FIELD_ROOT_CONTEXT: FieldRootContext = {
  invalid: () => undefined,
  name: () => undefined,
  validityData: DEFAULT_VALIDITY_DATA,
  setValidityData: NOOP_VALIDITY_SETTER,
  disabled: () => undefined,
  setTouched: noop,
  setDirty: noop,
  setFilled: noop,
  setFocused: noop,
  getFocusOwner: () => undefined,
  setFocusOwner: noop,
  validationMode: "onSubmit",
  shouldValidateOnChange: () => false,
  state: DEFAULT_FIELD_ROOT_STATE,
  registerFieldControl: noop,
  validation: {
    getValidationProps: (_disabled: () => boolean, externalProps: Record<string, any> = EMPTY_OBJECT) => externalProps,
    inputElement: null,
    registeredInputs: new Map(),
    registerInput: noop,
    getInputControl: () => null,
    commit: async () => {},
    change: noop,
  },
};

export const FieldRootContext = createContext<FieldRootContext>(DEFAULT_FIELD_ROOT_CONTEXT);

export function useFieldRootContext(optional?: false): FieldRootContext;
export function useFieldRootContext(optional: true): FieldRootContext;
export function useFieldRootContext(optional = true): FieldRootContext {
  const context = useContext(FieldRootContext);
  if (context.setValidityData === NOOP_VALIDITY_SETTER && !optional) {
    throw new Error("Rebase UI: FieldRootContext is missing. Field parts must be placed within <Field.Root>.");
  }

  return context;
}
