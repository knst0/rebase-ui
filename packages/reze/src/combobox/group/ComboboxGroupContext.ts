import { createContext, useContext } from "reze-js";

export interface ComboboxGroupContext {
  labelId: string | undefined;
  setLabelId: (next: string | undefined | ((prev: string | undefined) => string | undefined)) => void;
  /**
   * Optional list of items that belong to this group. Used by nested
   * collections to render group-specific items.
   */
  items?: readonly any[] | undefined;
}

export const ComboboxGroupContext = createContext<ComboboxGroupContext | undefined>(undefined);

export function useComboboxGroupContext(): ComboboxGroupContext {
  const context = useContext(ComboboxGroupContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ComboboxGroupContext is missing. ComboboxGroup parts must be placed within <Combobox.Group>.");
  }
  return context;
}
