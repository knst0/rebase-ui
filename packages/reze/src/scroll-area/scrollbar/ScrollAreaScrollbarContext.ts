import { createContext, useContext } from "reze-js";

export type ScrollAreaScrollbarOrientation = "horizontal" | "vertical";

export type ScrollAreaScrollbarContext = ScrollAreaScrollbarOrientation;

export const ScrollAreaScrollbarContext = createContext<ScrollAreaScrollbarContext | undefined>(undefined);

export function useScrollAreaScrollbarContext(): ScrollAreaScrollbarContext {
  const context = useContext(ScrollAreaScrollbarContext);

  if (context === undefined) {
    throw new Error("Rebase UI: ScrollAreaScrollbarContext is missing. ScrollArea parts must be placed within <ScrollArea.Scrollbar>.");
  }

  return context;
}
