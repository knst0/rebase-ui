import { createContext, useContext } from "../../internals/context";
import type { MenuStore } from "../store/MenuStore";

export interface MenuSubmenuRootContext {
  parentMenu: MenuStore<unknown>;
}

export const MenuSubmenuRootContext = createContext<MenuSubmenuRootContext>();

export function useMenuSubmenuRootContext(): MenuSubmenuRootContext | undefined {
  return useContext(MenuSubmenuRootContext);
}
