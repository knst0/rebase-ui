import { createContext, useContext } from "../../internals/context";
import type { MenuParent, MenuStore } from "../store/MenuStore";
import type { MenuRoot } from "./MenuRoot";

export interface MenuRootContext<Payload = unknown> {
  store: MenuStore<Payload>;
  parent: MenuParent;
  orientation: MenuRoot.Orientation;
  loopFocus: boolean;
  /** Whether arrow keys can step from either end of the list back to a virtual focus owner. */
  allowEscape: boolean;
  virtualFocus: boolean;
  parentVirtualFocus: boolean;
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
