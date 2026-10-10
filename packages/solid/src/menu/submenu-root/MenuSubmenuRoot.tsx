import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";

import { useMenuFilterProviderContext } from "../filter-provider/MenuFilterProviderContext";
import { MenuRoot, type MenuRoot as MenuRootNamespace } from "../root/MenuRoot";
import { useMenuRootContext } from "../root/MenuRootContext";
import { MenuSubmenuRootContext } from "./MenuSubmenuRootContext";

/**
 * Groups all parts of a submenu.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuSubmenuRoot(props: MenuSubmenuRoot.Props) {
  const filterProvider = useMenuFilterProviderContext();
  if (filterProvider) {
    const FilterSubmenuRoot = filterProvider.SubmenuRoot;
    // The provider's own `children` is this root's element: omitting (not reading) it keeps the
    // element from setting up a second time and lets this root's children through.
    const filterOptions = omit(filterProvider.options, "children");
    return <FilterSubmenuRoot {...(props as Record<string, unknown>)} {...filterOptions} />;
  }

  const parentMenu = useMenuRootContext().store;

  return (
    <MenuSubmenuRootContext value={{ parentMenu }}>
      <MenuRoot
        defaultOpen={props.defaultOpen}
        loopFocus={props.loopFocus}
        highlightItemOnHover={props.highlightItemOnHover}
        onOpenChange={props.onOpenChange}
        onOpenChangeComplete={props.onOpenChangeComplete}
        onItemHighlighted={props.onItemHighlighted}
        actionsRef={props.actionsRef}
        open={props.open}
        orientation={props.orientation}
        disabled={props.disabled}
        closeParentOnEsc={props.closeParentOnEsc}
      >
        {props.children}
      </MenuRoot>
    </MenuSubmenuRootContext>
  );
}

export interface MenuSubmenuRootProps extends Omit<
  MenuRootNamespace.Props,
  "modal" | "onOpenChange" | "handle" | "triggerId" | "children"
> {
  /**
   * Event handler called when the submenu is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: MenuSubmenuRoot.ChangeEventDetails) => void) | undefined;
  /**
   * When in a submenu, determines whether pressing the Escape key
   * closes the entire menu, or only the current child menu.
   * @default false
   */
  closeParentOnEsc?: boolean | undefined;
  /**
   * The content of the submenu.
   */
  children?: JSX.Element | undefined;
}

export interface MenuSubmenuRootState {}

export type MenuSubmenuRootChangeEventReason = MenuRoot.ChangeEventReason;
export type MenuSubmenuRootChangeEventDetails = MenuRoot.ChangeEventDetails;

export namespace MenuSubmenuRoot {
  export type Props = MenuSubmenuRootProps;
  export type State = MenuSubmenuRootState;
  export type ChangeEventReason = MenuSubmenuRootChangeEventReason;
  export type ChangeEventDetails = MenuSubmenuRootChangeEventDetails;
}
