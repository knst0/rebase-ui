import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../internals/context";
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

export const ComboboxRootContext = createContext<ComboboxStore>();
export const ComboboxFloatingContext = createContext<FloatingRootStore>();
export const ComboboxDerivedItemsContext = createContext<ComboboxDerivedItemsContextValue>();
export const ComboboxHasItemsContext = createContext<Accessor<boolean>>();
// `inputValue` can't be placed in the store.
// https://github.com/mui/base-ui/issues/2703
export const ComboboxInputValueContext = createContext<Accessor<string>>();

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

export function useComboboxInputValueContext(): Accessor<string> {
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
