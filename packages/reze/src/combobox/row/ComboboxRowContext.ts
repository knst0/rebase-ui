import { createContext, useContext } from "reze-js";

export const ComboboxRowContext = createContext<boolean | undefined>(undefined);

export function useComboboxRowContext(): boolean {
  return useContext(ComboboxRowContext) ?? false;
}
