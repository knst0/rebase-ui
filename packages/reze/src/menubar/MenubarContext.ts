import { createContext, useContext } from "reze-js";

import type { FloatingTreeStore } from "../internals/floating/tree/FloatingTreeStore";
import type { Orientation } from "../internals/types";

export interface MenubarContext {
  modal: () => boolean;
  disabled: () => boolean;
  hasSubmenuOpen: () => boolean;
  setHasSubmenuOpen: (open: boolean) => void;
  contentElement: () => HTMLElement | null;
  orientation: Orientation;
  allowMouseUpTriggerRef: { current: boolean };
  rootId: string;
  floatingTreeRoot: FloatingTreeStore;
}

export const MenubarContext = createContext<MenubarContext | undefined>(undefined);

export function useMenubarContext(optional: false): MenubarContext;
export function useMenubarContext(optional?: true): MenubarContext | undefined;
export function useMenubarContext(optional = true): MenubarContext | undefined {
  const context = useContext(MenubarContext);

  if (context === undefined && !optional) {
    throw new Error("Rebase UI: MenubarContext is missing. Menubar parts must be placed within <Menubar>.");
  }

  return context;
}
