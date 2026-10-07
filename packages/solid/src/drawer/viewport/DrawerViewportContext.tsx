import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../internals/context";

export interface DrawerViewportContextValue {
  swiping: Accessor<boolean>;
  getDragStyles: () => Record<string, string | undefined>;
  swipeStrength: Accessor<number | null>;
  setSwipeDismissed: (dismissed: boolean) => void;
}

export const DrawerViewportContext = createContext<DrawerViewportContextValue>();

export function useDrawerViewportContext(optional?: false): DrawerViewportContextValue;
export function useDrawerViewportContext(optional: true): DrawerViewportContextValue | undefined;
export function useDrawerViewportContext(optional?: boolean): DrawerViewportContextValue | undefined {
  const context = useContext(DrawerViewportContext);

  if (!optional && context === undefined) {
    throw new Error("Rebase UI: DrawerViewportContext is missing. Drawer parts must be placed within <Drawer.Viewport>.");
  }

  return context;
}
