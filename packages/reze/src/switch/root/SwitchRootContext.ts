import { createContext, useContext } from "reze-js";

import type { FieldRootStateSelectors } from "../../internals/field-constants";

export interface SwitchRootContext extends FieldRootStateSelectors {
  checked: () => boolean;
  readOnly: () => boolean;
  required: () => boolean;
}

export const SwitchRootContext = createContext<SwitchRootContext | undefined>(undefined);

export function useSwitchRootContext(): SwitchRootContext {
  const context = useContext(SwitchRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.");
  }

  return context;
}
