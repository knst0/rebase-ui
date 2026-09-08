import { type Accessor, createContext, type Store, type StoreSetter, useContext } from "solid-js";

import { EMPTY_OBJECT, NOOP } from "#utils/empty";

import type { CreateFieldValidationReturnValue } from "../../field/root/createFieldValidation";
import type { FieldRootState, FieldValidityData } from "../../field/root/FieldRoot";
import type { Form } from "../../form/Form";
import { DEFAULT_FIELD_ROOT_STATE, DEFAULT_VALIDITY_STATE } from "../field-constants";
import type { FieldControlRegistration } from "../field-register-control/createFieldControlRegistration";
import type { RegistrationSource } from "../types";

export interface FieldRootContext {
  invalid: Accessor<boolean | undefined>;
  name: Accessor<string | undefined>;
  validityData: Store<FieldValidityData>;
  setValidityData: StoreSetter<FieldValidityData>;
  disabled: Accessor<boolean | undefined>;
  setTouched: (value: boolean) => void;
  setDirty: (value: boolean) => void;
  setFilled: (value: boolean) => void;
  setFocused: (value: boolean) => void;
  validationMode: Form.ValidationMode;
  shouldValidateOnChange: () => boolean;
  state: FieldRootState;
  registerFieldControl: (source: RegistrationSource, registration: FieldControlRegistration | undefined) => void;
  validation: CreateFieldValidationReturnValue;
}

const DEFAULT_VALIDITY_DATA: FieldValidityData = {
  state: DEFAULT_VALIDITY_STATE,
  errors: [],
  error: "",
  value: "",
  initialValue: null,
};

const NOOP_VALIDITY_SETTER: StoreSetter<FieldValidityData> = NOOP;

// fixme: в идеале вообще не держать? считаю возможно лишняя аллокация, стоит проверить бенчем
export const DEFAULT_FIELD_ROOT_CONTEXT: FieldRootContext = {
  invalid: () => undefined,
  name: () => undefined,
  validityData: DEFAULT_VALIDITY_DATA,
  setValidityData: NOOP_VALIDITY_SETTER,
  disabled: () => undefined,
  setTouched: NOOP,
  setDirty: NOOP,
  setFilled: NOOP,
  setFocused: NOOP,
  validationMode: "onSubmit",
  shouldValidateOnChange: () => false,
  state: DEFAULT_FIELD_ROOT_STATE,
  registerFieldControl: NOOP,
  validation: {
    getValidationProps: (_disabled: boolean, props: Record<string, any> = EMPTY_OBJECT) => props,
    inputElement: null,
    registeredInputs: new Map(),
    registerInput: NOOP,
    getInputControl: () => null,
    commit: async () => {},
    change: NOOP,
  },
};

export const FieldRootContext = createContext<FieldRootContext>(DEFAULT_FIELD_ROOT_CONTEXT);

export function useFieldRootContext(optional = true): FieldRootContext {
  const context = useContext(FieldRootContext);
  if (context.setValidityData === NOOP_VALIDITY_SETTER && !optional) {
    throw new Error("Rebase UI: FieldRootContext is missing. Field parts must be placed within <Field.Root>.");
  }

  return context;
}
