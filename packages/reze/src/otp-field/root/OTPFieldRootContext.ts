import { createContext, useContext } from "reze-js";

import type { OTPFieldInputState } from "../input/OTPFieldInput";
import type { OTPFieldInputMode, OTPFieldRoot, OTPFieldRootState, OTPFieldRootStateSelectors } from "./OTPFieldRoot";

export interface OTPFieldRootContext {
  activeIndex: () => number;
  autoComplete: () => string | undefined;
  disabled: () => boolean;
  form: () => string | undefined;
  focusInput: (index: number) => void;
  queueFocusInput: (index: number, value: string) => void;
  getInputId: (index: number) => string | undefined;
  handleInputBlur: (event: FocusEvent) => void;
  handleInputFocus: (index: number, event: FocusEvent) => void;
  inputMode: () => OTPFieldInputMode | undefined;
  inputAriaLabelledBy: () => string | undefined;
  invalid: () => boolean | undefined;
  length: () => number;
  mask: () => boolean;
  pattern: () => string | undefined;
  reportValueInvalid: (value: string, details: OTPFieldRoot.InvalidEventDetails) => void;
  readOnly: () => boolean;
  required: () => boolean;
  normalizeValue: () => ((value: string) => string) | undefined;
  setFocused: (focused: boolean) => void;
  setValue: (value: string, details: OTPFieldRoot.ChangeEventDetails) => string | null;
  state: OTPFieldRootStateSelectors;
  validationType: () => OTPFieldRoot.ValidationType;
  value: () => string;
}

export const OTPFieldRootContext = createContext<OTPFieldRootContext | undefined>(undefined);

export function useOTPFieldRootContext() {
  const context = useContext(OTPFieldRootContext);

  if (context === undefined) {
    throw new Error("Rebase UI: OTPFieldRootContext is missing. OTPField parts must be placed within <OTPField.Root>.");
  }

  return context;
}

export function getOTPFieldInputState(state: OTPFieldRootState, value: string, index: number): OTPFieldInputState {
  return {
    ...state,
    value,
    index,
    filled: value !== "",
  };
}
