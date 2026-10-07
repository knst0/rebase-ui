import { createContext, useContext } from "../../internals/context";
import type { CheckboxRootState } from "./CheckboxRoot";

export type CheckboxRootContext = CheckboxRootState;

export const CheckboxRootContext = createContext<CheckboxRootContext>();

export function useCheckboxRootContext(): CheckboxRootContext {
  const context = useContext(CheckboxRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: CheckboxRootContext is missing. Checkbox parts must be placed within <Checkbox.Root>.");
  }

  return context;
}
