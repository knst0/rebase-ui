import { createContext, useContext } from "reze-js";

export interface ComboboxChipContext {
  index: () => number;
}

export const ComboboxChipContext = createContext<ComboboxChipContext | undefined>(undefined);

export function useComboboxChipContext(): ComboboxChipContext {
  const context = useContext(ComboboxChipContext);
  if (!context) {
    throw new Error("Rebase UI: ComboboxChipContext is missing. ComboboxChip parts must be placed within <Combobox.Chip>.");
  }
  return context;
}
