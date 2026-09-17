import type { Setter } from "solid-js";

import { createContext, useContext } from "../../internals/context";

export interface ComboboxGroupContext {
  labelId: string | undefined;
  setLabelId: Setter<string | undefined>;
  /**
   * Optional list of items that belong to this group. Used by nested
   * collections to render group-specific items.
   */
  items?: readonly any[] | undefined;
}

export const ComboboxGroupContext = createContext<ComboboxGroupContext>();

export function useComboboxGroupContext(): ComboboxGroupContext {
  const context = useContext(ComboboxGroupContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ComboboxGroupContext is missing. ComboboxGroup parts must be placed within <Combobox.Group>.");
  }
  return context;
}
