import { createContext, useContext } from "../../internals/context";
import type { SwitchRootState } from "./SwitchRoot";

export type SwitchRootContext = SwitchRootState;

export const SwitchRootContext = createContext<SwitchRootContext>();

export function useSwitchRootContext(): SwitchRootContext {
  const context = useContext(SwitchRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.");
  }

  return context;
}
