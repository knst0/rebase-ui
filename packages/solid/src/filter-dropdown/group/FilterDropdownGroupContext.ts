import { createContext, useContext } from "../../internals/context";

export interface FilterDropdownGroupContext {
  registerItem: (id: symbol, retained: boolean) => () => void;
}

export const FilterDropdownGroupContext = createContext<FilterDropdownGroupContext | null>();

export function useFilterDropdownGroupContext() {
  return useContext(FilterDropdownGroupContext) ?? null;
}
