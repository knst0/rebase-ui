import { createContext, useContext } from "reze-js";

import type { CreateFieldValidationReturnValue } from "../field/root/createFieldValidation";
import type { EventReasons, RebaseUIChangeEventDetails } from "../internals/event-details";

export interface RadioGroupContext {
  disabled: () => boolean;
  readOnly: () => boolean;
  required: () => boolean;
  form: string | undefined;
  name: string | undefined;
  checkedValue: () => any;
  setCheckedValue: (value: any, eventDetails: RebaseUIChangeEventDetails<EventReasons["none"]>) => void;
  touched: () => boolean;
  setTouched: (value: boolean) => void;
  validation: CreateFieldValidationReturnValue;
  registerInputRef: (element: HTMLInputElement | null, isChecked?: boolean) => void | (() => void);
  /**
   * The group element, used to resolve the radios in DOM order for the roving tabindex.
   */
  getGroupElement: () => HTMLElement | null;
  /**
   * Bumped whenever a radio mounts or unmounts so every roving-tabindex binding re-evaluates.
   */
  itemsVersion: () => number;
  registerItem: (element: HTMLElement) => () => void;
}

export const RadioGroupContext = createContext<RadioGroupContext | undefined>(undefined);

export function useRadioGroupContext(): RadioGroupContext | undefined {
  return useContext(RadioGroupContext);
}
