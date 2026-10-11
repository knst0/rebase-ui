import { useMenuRootContext } from "../root/MenuRootContext";
import type { MenuStore } from "../store/MenuStore";
import type { UseMenuItemMetadata } from "./useMenuItem";

export interface UseMenuItemCommonPropsParameters {
  /**
   * Determines if the menu item is highlighted.
   */
  highlighted: () => boolean;
  /**
   * The menu store.
   */
  store: MenuStore<any>;
  /**
   * Metadata for checking item type before triggering click.
   */
  itemMetadata: UseMenuItemMetadata;
}

/**
 * Returns common props shared by all menu item types: the focus model (`tabIndex`) and the
 * WebKit selection state. A submenu trigger is an item of the parent menu's list, so it follows
 * that list's focus model.
 */
export function useMenuItemCommonProps(params: UseMenuItemCommonPropsParameters) {
  const { highlighted, store, itemMetadata } = params;

  const rootContext = useMenuRootContext();

  // A submenu trigger is an item of the parent menu's list, so it follows that list's focus model.
  const isSubmenuTrigger = itemMetadata.type === "submenu-trigger";
  const virtualFocus = isSubmenuTrigger ? rootContext.parentVirtualFocus : rootContext.virtualFocus;
  const parent = store.peek("parent") as { type: "menu"; store: MenuStore<unknown> } | { type: undefined };
  const selectionStore = isSubmenuTrigger && parent.type === "menu" ? parent.store : (store as MenuStore<unknown>);

  const tabIndex = () => {
    const open = store.select("open") as boolean;
    // `-1` rather than omitting it, which leaves links and buttons in the tab order.
    return !virtualFocus && open && highlighted() ? 0 : -1;
  };

  const ariaSelected = () => selectionStore.select("webkitAriaSelected", highlighted()) as true | undefined;

  return {
    tabIndex,
    ariaSelected,
    virtualFocus,
  };
}
