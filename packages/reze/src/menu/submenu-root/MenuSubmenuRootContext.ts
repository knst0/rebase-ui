import { createContext, useContext } from "reze-js";

import type { MenuStore } from "../store/MenuStore";

export interface MenuSubmenuRootContext {
  parentMenu: MenuStore<unknown>;
  getReturnElement?: (() => HTMLElement | null) | undefined;
  onTriggerKeyDown?: ((event: KeyboardEvent & { currentTarget: HTMLElement }) => void) | undefined;
  onPopupKeyDown?: ((event: KeyboardEvent) => void) | undefined;
}

export const MenuSubmenuRootContext = createContext<MenuSubmenuRootContext | undefined>(undefined);

export function useMenuSubmenuRootContext(): MenuSubmenuRootContext | undefined {
  return useContext(MenuSubmenuRootContext);
}
