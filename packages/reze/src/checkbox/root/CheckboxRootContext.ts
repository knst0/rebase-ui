import { createContext, useContext } from "reze-js";

import type { FieldRootStateSelectors } from "../../internals/field-constants";

export interface CheckboxRootContext extends FieldRootStateSelectors {
  checked: () => boolean;
  readOnly: () => boolean;
  required: () => boolean;
  indeterminate: () => boolean;
}

export const CheckboxRootContext = createContext<CheckboxRootContext | undefined>(undefined);

export function useCheckboxRootContext(): CheckboxRootContext {
  const context = useContext(CheckboxRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: CheckboxRootContext is missing. Checkbox parts must be placed within <Checkbox.Root>.");
  }

  return context;
}
