import { createContext, useContext } from "../../internals/context";
import type { MenuStore } from "../store/MenuStore";

export interface MenuSubmenuRootContext {
  parentMenu: MenuStore<unknown>;
  getReturnElement?: (() => HTMLElement | null) | undefined;
  onTriggerKeyDown?: ((event: KeyboardEvent & { currentTarget: HTMLElement }) => void) | undefined;
  onPopupKeyDown?: ((event: KeyboardEvent) => void) | undefined;
}

export const MenuSubmenuRootContext = createContext<MenuSubmenuRootContext>();

export function useMenuSubmenuRootContext(): MenuSubmenuRootContext | undefined {
  return useContext(MenuSubmenuRootContext);
}
