import type { JSX } from "@solidjs/web";

import { MenuRoot } from "../root/MenuRoot";
import { useMenuRootContext } from "../root/MenuRootContext";
import { MenuSubmenuRootContext } from "./MenuSubmenuRootContext";

/**
 * Groups all parts of a submenu.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuSubmenuRoot(props: MenuSubmenuRoot.Props) {
  const parentMenu = useMenuRootContext().store;

  return (
    <MenuSubmenuRootContext value={{ parentMenu }}>
      <MenuRoot
        defaultOpen={props.defaultOpen}
        loopFocus={props.loopFocus}
        highlightItemOnHover={props.highlightItemOnHover}
        onOpenChange={props.onOpenChange}
        onOpenChangeComplete={props.onOpenChangeComplete}
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

export interface MenuSubmenuRootProps {
  /**
   * Whether the submenu is initially open.
   *
   * To render a controlled submenu, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Event handler called when the submenu is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: MenuSubmenuRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the submenu is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the submenu is currently open.
   */
  open?: boolean | undefined;
  /**
   * The visual orientation of the submenu.
   * @default 'vertical'
   */
  orientation?: MenuRoot.Orientation | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
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
