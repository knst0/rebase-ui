import { createContext, useContext } from "../../internals/context";

export const ComboboxRowContext = createContext<boolean>();

export function useComboboxRowContext(): boolean {
  return useContext(ComboboxRowContext) ?? false;
}
