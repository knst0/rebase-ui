import { createContext, useContext } from "../../internals/context";

export const ComboboxPortalContext = createContext<boolean>();

export function useComboboxPortalContext(): boolean {
  return useContext(ComboboxPortalContext) ?? false;
}
