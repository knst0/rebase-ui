import { createContext, useContext } from "reze-js";

import type { FloatingRootStore } from "../../internals/floating/tree/FloatingRootStore";
import type { ComboboxStore } from "../store/ComboboxStore";

export interface ComboboxDerivedItemsContextValue {
  readonly query: string;
  readonly hasItems: boolean;
  readonly filteredItems: any[];
  /**
   * `filteredItems` flattened across groups and projected to selection values. Identical to the
   * items themselves unless `items` is a `createItems()` collection.
   */
  readonly flatFilteredValues: any[];
}

export const ComboboxRootContext = createContext<ComboboxStore | undefined>(undefined);
export const ComboboxFloatingContext = createContext<FloatingRootStore | undefined>(undefined);
export const ComboboxDerivedItemsContext = createContext<ComboboxDerivedItemsContextValue | undefined>(undefined);
export const ComboboxHasItemsContext = createContext<(() => boolean) | undefined>(undefined);
// `inputValue` can't be placed in the store.
// https://github.com/mui/base-ui/issues/2703
export const ComboboxInputValueContext = createContext<(() => string) | undefined>(undefined);

export function useComboboxRootContext(): ComboboxStore {
  const store = useContext(ComboboxRootContext);
  if (store === undefined) {
    throw new Error("Rebase UI: ComboboxRootContext is missing. Combobox parts must be placed within <Combobox.Root>.");
  }
  return store;
}

export function useComboboxFloatingContext(): FloatingRootStore {
  const context = useContext(ComboboxFloatingContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ComboboxFloatingContext is missing. Combobox parts must be placed within <Combobox.Root>.");
  }
  return context;
}

export function useComboboxDerivedItemsContext(): ComboboxDerivedItemsContextValue {
  const context = useContext(ComboboxDerivedItemsContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ComboboxItemsContext is missing. Combobox parts must be placed within <Combobox.Root>.");
  }
  return context;
}

export function useComboboxInputValueContext(): () => string {
  const context = useContext(ComboboxInputValueContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ComboboxInputValueContext is missing. Combobox parts must be placed within <Combobox.Root>.");
  }
  return context;
}

export function useComboboxHasItemsContext(): boolean {
  const context = useContext(ComboboxHasItemsContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ComboboxHasItemsContext is missing. Combobox parts must be placed within <Combobox.Root>.");
  }
  return context();
}
