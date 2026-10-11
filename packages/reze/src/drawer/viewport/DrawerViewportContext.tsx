import { createContext, useContext } from "reze-js";

export interface DrawerViewportContextValue {
  swiping: () => boolean;
  getDragStyles: () => Record<string, string | undefined>;
  swipeStrength: () => number | null;
  setSwipeDismissed: (dismissed: boolean) => void;
}

export const DrawerViewportContext = createContext<DrawerViewportContextValue | undefined>(undefined);

export function useDrawerViewportContext(optional?: false): DrawerViewportContextValue;
export function useDrawerViewportContext(optional: true): DrawerViewportContextValue | undefined;
export function useDrawerViewportContext(optional?: boolean): DrawerViewportContextValue | undefined {
  const context = useContext(DrawerViewportContext);

  if (!optional && context === undefined) {
    throw new Error("Rebase UI: DrawerViewportContext is missing. Drawer parts must be placed within <Drawer.Viewport>.");
  }

  return context;
}
