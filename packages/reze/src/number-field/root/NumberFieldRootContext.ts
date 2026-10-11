import { createContext, useContext } from "reze-js";

import type { EventWithOptionalKeyState, IncrementValueParameters } from "../utils/types";
import type { NumberFieldRoot, NumberFieldRootStateSelectors } from "./NumberFieldRoot";

export type InputMode = "numeric" | "decimal" | "text";

export interface NumberFieldRootContext {
  minWithDefault: () => number;
  maxWithDefault: () => number;
  id: () => string;
  setValue: (value: number | null, details: NumberFieldRoot.ChangeEventDetails) => boolean;
  getStepAmount: (event?: EventWithOptionalKeyState) => number;
  incrementValue: (amount: number, params: IncrementValueParameters) => boolean;
  inputElement: () => HTMLInputElement | null;
  setInputElement: (element: HTMLInputElement | null) => void;
  focusInput: () => void;
  allowInputSyncRef: { current: boolean };
  valueRef: { current: number | null };
  lastChangedValueRef: { current: number | null };
  hasPendingCommitRef: { current: boolean };
  name: () => string | undefined;
  nameProp: () => string | undefined;
  inputMode: () => InputMode;
  getAllowedNonNumericKeys: () => Set<string>;
  min: () => number | undefined;
  max: () => number | undefined;
  setInputValue: (value: string) => void;
  format: () => Intl.NumberFormatOptions | undefined;
  inputValue: () => string;
  value: () => number | null;
  locale: () => Intl.LocalesArgument | undefined;
  setIsScrubbing: (value: boolean) => void;
  state: NumberFieldRootStateSelectors;
  onValueCommitted: (value: number | null, eventDetails: NumberFieldRoot.CommitEventDetails) => void;
}

export const NumberFieldRootContext = createContext<NumberFieldRootContext | undefined>(undefined);

export function useNumberFieldRootContext() {
  const context = useContext(NumberFieldRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: NumberFieldRootContext is missing. NumberField parts must be placed within <NumberField.Root>.");
  }

  return context;
}
