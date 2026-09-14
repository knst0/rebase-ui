import { createContext, useContext } from "../../internals/context";
import type { RadioRootState } from "./RadioRoot";

export type RadioRootContext = RadioRootState;

export const RadioRootContext = createContext<RadioRootContext>();

export function useRadioRootContext(): RadioRootContext {
  const context = useContext(RadioRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: RadioRootContext is missing. Radio parts must be placed within <Radio.Root>.");
  }

  return context;
}
