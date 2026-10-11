import { createContext, useContext } from "reze-js";

export interface FilterDropdownGroupContext {
  registerItem: (id: symbol, retained: boolean) => () => void;
}

export const FilterDropdownGroupContext = createContext<FilterDropdownGroupContext | null>(null);

export function useFilterDropdownGroupContext(): FilterDropdownGroupContext | null {
  return useContext(FilterDropdownGroupContext) ?? null;
}
