import { createContext, useContext } from "reze-js";

export interface ComboboxChipsContext {
  chipsRef: { current: Array<HTMLElement | null> };
}

export const ComboboxChipsContext = createContext<ComboboxChipsContext | undefined>(undefined);

export function useComboboxChipsContext(): ComboboxChipsContext | undefined {
  return useContext(ComboboxChipsContext);
}
