import { useFilterDropdownItem } from "../../filter-dropdown/item/useFilterDropdownItem";
import type { MenuFilterItemParams, MenuFilterItemResult } from "./MenuFilterContext";

/**
 * Registers an item with the enclosing filter root and reports whether the query keeps it.
 */
export function useMenuFilterItem(params: MenuFilterItemParams): MenuFilterItemResult {
  const { visible, ref } = useFilterDropdownItem(params);

  return {
    visible,
    ref: (element: HTMLElement | null) => {
      ref.current = element;
    },
  };
}
