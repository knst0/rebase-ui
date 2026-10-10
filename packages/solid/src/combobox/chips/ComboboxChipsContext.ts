import { createContext, useContext } from "../../internals/context";

export interface ComboboxChipsContext {
  chipsRef: { current: Array<HTMLElement | null> };
}

export const ComboboxChipsContext = createContext<ComboboxChipsContext>();

export function useComboboxChipsContext(): ComboboxChipsContext | undefined {
  return useContext(ComboboxChipsContext);
}
