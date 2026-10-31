import type { Accessor } from "solid-js";

import { createContext, useContext } from "../internals/context";
import type { FloatingTreeStore } from "../internals/floating/tree/FloatingTreeStore";
import type { Orientation } from "../internals/types";

export interface MenubarContext {
  modal: Accessor<boolean>;
  disabled: Accessor<boolean>;
  hasSubmenuOpen: Accessor<boolean>;
  setHasSubmenuOpen: (open: boolean) => void;
  contentElement: Accessor<HTMLElement | null>;
  orientation: Orientation;
  allowMouseUpTriggerRef: { current: boolean };
  rootId: string;
  floatingTreeRoot: FloatingTreeStore;
}

export const MenubarContext = createContext<MenubarContext>();

export function useMenubarContext(optional: false): MenubarContext;
export function useMenubarContext(optional?: true): MenubarContext | undefined;
export function useMenubarContext(optional = true): MenubarContext | undefined {
  const context = useContext(MenubarContext);

  if (context === undefined && !optional) {
    throw new Error("Rebase UI: MenubarContext is missing. Menubar parts must be placed within <Menubar>.");
  }

  return context;
}
