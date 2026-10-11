import { createContext, useContext } from "reze-js";

export interface ScrollAreaViewportContext {
  computeThumbPosition: () => void;
}

export const ScrollAreaViewportContext = createContext<ScrollAreaViewportContext | undefined>(undefined);

export function useScrollAreaViewportContext(): ScrollAreaViewportContext {
  const context = useContext(ScrollAreaViewportContext);

  if (context === undefined) {
    throw new Error("Rebase UI: ScrollAreaViewportContext is missing. ScrollArea parts must be placed within <ScrollArea.Viewport>.");
  }

  return context;
}
