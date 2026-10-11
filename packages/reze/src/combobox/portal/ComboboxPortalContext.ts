import { createContext, useContext } from "reze-js";

export const ComboboxPortalContext = createContext<boolean | undefined>(undefined);

export function useComboboxPortalContext(): boolean {
  return useContext(ComboboxPortalContext) ?? false;
}
