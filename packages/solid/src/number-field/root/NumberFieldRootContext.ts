import type { Accessor, Setter } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { NumberFieldRoot, NumberFieldRootState } from "./NumberFieldRoot";
import type { EventWithOptionalKeyState, IncrementValueParameters } from "../utils/types";

export type InputMode = "numeric" | "decimal" | "text";

export interface NumberFieldRootContext {
  minWithDefault: Accessor<number>;
  maxWithDefault: Accessor<number>;
  id: Accessor<string>;
  setValue: (value: number | null, details: NumberFieldRoot.ChangeEventDetails) => boolean;
  getStepAmount: (event?: EventWithOptionalKeyState) => number;
  incrementValue: (amount: number, params: IncrementValueParameters) => boolean;
  inputElement: Accessor<HTMLInputElement | null>;
  setInputElement: (element: HTMLInputElement | null) => void;
  allowInputSyncRef: { current: boolean };
  valueRef: { current: number | null };
  lastChangedValueRef: { current: number | null };
  hasPendingCommitRef: { current: boolean };
  name: Accessor<string | undefined>;
  nameProp: Accessor<string | undefined>;
  inputMode: Accessor<InputMode>;
  getAllowedNonNumericKeys: () => Set<string>;
  min: Accessor<number | undefined>;
  max: Accessor<number | undefined>;
  setInputValue: (value: string) => void;
  format: Accessor<Intl.NumberFormatOptions | undefined>;
  inputValue: Accessor<string>;
  value: Accessor<number | null>;
  locale: Accessor<Intl.LocalesArgument | undefined>;
  setIsScrubbing: Setter<boolean>;
  state: NumberFieldRootState;
  onValueCommitted: (value: number | null, eventDetails: NumberFieldRoot.CommitEventDetails) => void;
}

export const NumberFieldRootContext = createContext<NumberFieldRootContext>();

export function useNumberFieldRootContext() {
  const context = useContext(NumberFieldRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: NumberFieldRootContext is missing. NumberField parts must be placed within <NumberField.Root>.");
  }

  return context;
}
