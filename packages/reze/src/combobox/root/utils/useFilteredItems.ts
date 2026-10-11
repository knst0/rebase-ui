import { useComboboxDerivedItemsContext } from "../ComboboxRootContext";

/**
 * Returns the internally filtered items.
 * Treat the result as read-only: it is internal state and may be a shared frozen array.
 * Must be called in a tracking scope; the returned array updates reactively.
 */
export function useFilteredItems<T>(): T[] {
  const items = useComboboxDerivedItemsContext();
  return items.filteredItems as T[];
}
