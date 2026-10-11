import type { JSX } from "reze-js";

import type { FilterDropdownRoot } from "../../filter-dropdown/root/FilterDropdownRootContext";
import { MenuFilterRoot } from "../filter-root/MenuFilterRoot";
import { MenuFilterSubmenuRoot } from "../filter-submenu-root/MenuFilterSubmenuRoot";
import { MenuFilterProviderContext } from "./MenuFilterProviderContext";
import type { MenuFilterProviderOptions } from "./MenuFilterProviderOptions";

/**
 * Enables filtering for the menu or submenu it wraps. Add `Menu.Input` to the popup and place
 * its items in `Menu.List`.
 * Wrap each searchable submenu in its own provider.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuFilterProvider(props: MenuFilterProvider.Props): JSX.Element {
  // The props object itself is the options: reads stay reactive for controlled updates.
  // `props.children` passes through the JSX below without an eager body read, so the
  // root is created inside the provider and sees the filter options.
  return (
    <MenuFilterProviderContext value={{ Root: MenuFilterRoot, SubmenuRoot: MenuFilterSubmenuRoot, options: props }}>
      {props.children}
    </MenuFilterProviderContext>
  );
}

export interface MenuFilterProviderState {}

export interface MenuFilterProviderProps extends MenuFilterProviderOptions {
  /**
   * The `<Menu.Root>` or `<Menu.SubmenuRoot>` to make filterable.
   */
  children?: JSX.Element;
}

export type MenuFilterProviderChangeEventReason = FilterDropdownRoot.ChangeEventReason;
export type MenuFilterProviderChangeEventDetails = FilterDropdownRoot.ChangeEventDetails;

export namespace MenuFilterProvider {
  export type State = MenuFilterProviderState;
  export type Props = MenuFilterProviderProps;
  export type ChangeEventReason = MenuFilterProviderChangeEventReason;
  export type ChangeEventDetails = MenuFilterProviderChangeEventDetails;
}
