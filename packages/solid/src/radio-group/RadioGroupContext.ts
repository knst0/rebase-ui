import type { Accessor, Setter } from "solid-js";

import type { CreateFieldValidationReturnValue } from "../field/root/createFieldValidation";
import { createContext, useContext } from "../internals/context";
import type { EventReasons, RebaseUIChangeEventDetails } from "../internals/event-details";

export interface RadioGroupContext<Value> {
  disabled: Accessor<boolean | undefined>;
  readOnly: Accessor<boolean | undefined>;
  required: Accessor<boolean | undefined>;
  form: string | undefined;
  name: string | undefined;
  checkedValue: Accessor<Value | undefined>;
  setCheckedValue: (value: Value, eventDetails: RebaseUIChangeEventDetails<EventReasons["none"]>) => void;
  touched: Accessor<boolean>;
  setTouched: Setter<boolean>;
  validation: CreateFieldValidationReturnValue;
  registerInputRef: (element: HTMLInputElement | null) => void | (() => void);
}

export const RadioGroupContext = createContext<RadioGroupContext<any>>();

export function useRadioGroupContext(): RadioGroupContext<any> | undefined {
  return useContext(RadioGroupContext);
}
