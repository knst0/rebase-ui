import type { ValidComponent } from "@solidjs/web";

import {
  FilterDropdownEmpty,
  type FilterDropdownEmptyProps,
  type FilterDropdownEmptyState,
} from "../../filter-dropdown/empty/FilterDropdownEmpty";
import { useMenuFilterPart } from "../filter-root/MenuFilterContext";

/**
 * A message shown when the menu has no matching items.
 * Requires the menu to be wrapped in `Menu.FilterProvider`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuEmpty<T extends ValidComponent = "div">(props: MenuEmpty.Props<T>) {
  useMenuFilterPart("Empty");
  return <FilterDropdownEmpty {...(props as Record<string, unknown>)} />;
}

export interface MenuEmptyState extends FilterDropdownEmptyState {}
export type MenuEmptyProps<T extends ValidComponent = "div"> = FilterDropdownEmptyProps<T>;

export namespace MenuEmpty {
  export type State = MenuEmptyState;
  export type Props<T extends ValidComponent = "div"> = MenuEmptyProps<T>;
}
