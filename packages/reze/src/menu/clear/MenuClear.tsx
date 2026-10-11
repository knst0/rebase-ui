import type { JSX } from "reze-js";

import {
  FilterDropdownClear,
  type FilterDropdownClearProps,
  type FilterDropdownClearState,
} from "../../filter-dropdown/clear/FilterDropdownClear";
import { useMenuFilterPart } from "../filter-root/MenuFilterContext";

/**
 * A button that clears the input text.
 * Requires the menu to be wrapped in `Menu.FilterProvider`.
 * Renders a `<button>` element when the input has text.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuClear<T extends JSX.ElementType = "button">(props: MenuClear.Props<T>) {
  useMenuFilterPart("Clear");
  return <FilterDropdownClear {...(props as Record<string, unknown>)} />;
}

export interface MenuClearState extends FilterDropdownClearState {}
export type MenuClearProps<T extends JSX.ElementType = "button"> = FilterDropdownClearProps<T>;

export namespace MenuClear {
  export type State = MenuClearState;
  export type Props<T extends JSX.ElementType = "button"> = MenuClearProps<T>;
}
