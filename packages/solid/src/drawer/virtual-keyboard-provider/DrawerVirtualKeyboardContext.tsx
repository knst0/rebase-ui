import { createContext, useContext } from "../../internals/context";

export interface DrawerVirtualKeyboardContext {
  onTouchStart: (event: TouchEvent) => void;
  // Driven by the viewport's native `touchmove` listener so it still fires when the
  // swipe gesture claims the event with `stopPropagation()`.
  onTouchMove: (event: TouchEvent) => void;
  onTouchEnd: (event: TouchEvent) => void;
  onTouchCancel: () => void;
}

export const DrawerVirtualKeyboardContext = createContext<DrawerVirtualKeyboardContext>();

export function useDrawerVirtualKeyboardContext(optional?: false): DrawerVirtualKeyboardContext;
export function useDrawerVirtualKeyboardContext(optional: true): DrawerVirtualKeyboardContext | undefined;
export function useDrawerVirtualKeyboardContext(optional?: boolean): DrawerVirtualKeyboardContext | undefined {
  const context = useContext(DrawerVirtualKeyboardContext);

  if (!optional && context === undefined) {
    throw new Error("Rebase UI: DrawerVirtualKeyboardContext is missing. Parts must be placed within <Drawer.VirtualKeyboardProvider>.");
  }

  return context;
}
