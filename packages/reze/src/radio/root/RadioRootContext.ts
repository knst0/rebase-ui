import { createContext, useContext } from "reze-js";

export interface RadioRootContext {
  disabled: () => boolean;
  touched: () => boolean;
  dirty: () => boolean;
  valid: () => boolean | null;
  filled: () => boolean;
  focused: () => boolean;
  validating: () => boolean;
  checked: () => boolean;
  readOnly: () => boolean;
  required: () => boolean;
}

export const RadioRootContext = createContext<RadioRootContext | undefined>(undefined);

export function useRadioRootContext(): RadioRootContext {
  const context = useContext(RadioRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: RadioRootContext is missing. Radio parts must be placed within <Radio.Root>.");
  }

  return context;
}
