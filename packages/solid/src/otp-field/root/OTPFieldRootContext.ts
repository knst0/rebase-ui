import type { Accessor } from 'solid-js';

import { createContext, useContext } from '../../internals/context';
import type {
  OTPFieldInputMode,
  OTPFieldRoot,
  OTPFieldRootState,
} from './OTPFieldRoot';
import type { OTPFieldInputState } from '../input/OTPFieldInput';

export interface OTPFieldRootContext {
  activeIndex: Accessor<number>;
  autoComplete: Accessor<string | undefined>;
  disabled: Accessor<boolean>;
  form: Accessor<string | undefined>;
  focusInput: (index: number) => void;
  queueFocusInput: (index: number, value: string) => void;
  getInputId: (index: number) => string | undefined;
  handleInputBlur: (event: FocusEvent) => void;
  handleInputFocus: (index: number, event: FocusEvent & { currentTarget: HTMLInputElement }) => void;
  inputMode: Accessor<OTPFieldInputMode | undefined>;
  inputAriaLabelledBy: Accessor<string | undefined>;
  invalid: Accessor<boolean | undefined>;
  length: Accessor<number>;
  mask: Accessor<boolean>;
  pattern: Accessor<string | undefined>;
  reportValueInvalid: (value: string, details: OTPFieldRoot.InvalidEventDetails) => void;
  readOnly: Accessor<boolean>;
  required: Accessor<boolean>;
  normalizeValue: Accessor<((value: string) => string) | undefined>;
  setValue: (value: string, details: OTPFieldRoot.ChangeEventDetails) => string | null;
  state: OTPFieldRootState;
  validationType: Accessor<OTPFieldRoot.ValidationType>;
  value: Accessor<string>;
}

export const OTPFieldRootContext = createContext<OTPFieldRootContext>();

export function useOTPFieldRootContext() {
  const context = useContext(OTPFieldRootContext);

  if (context === undefined) {
    throw new Error(
      'Rebase UI: OTPFieldRootContext is missing. OTPField parts must be placed within <OTPField.Root>.',
    );
  }

  return context;
}

export function getOTPFieldInputState(
  state: OTPFieldRootState,
  value: string,
  index: number,
): OTPFieldInputState {
  return {
    ...state,
    value,
    index,
    filled: value !== '',
  };
}
