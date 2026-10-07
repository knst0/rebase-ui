import { createContext, useContext } from "../../internals/context";
import type { MenuParent, MenuStore } from "../store/MenuStore";

export interface MenuRootContext<Payload = unknown> {
  store: MenuStore<Payload>;
  parent: MenuParent;
}

export const MenuRootContext = createContext<MenuRootContext<any>>();

export function useMenuRootContext(optional?: false): MenuRootContext;
export function useMenuRootContext(optional: true): MenuRootContext | undefined;
export function useMenuRootContext(optional?: boolean): MenuRootContext | undefined {
  const context = useContext(MenuRootContext);

  if (context === undefined && !optional) {
    throw new Error("Rebase UI: MenuRootContext is missing. Menu parts must be placed within <Menu.Root>.");
  }

  return context;
}
