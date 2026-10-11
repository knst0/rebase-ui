import { createContext, useContext } from "reze-js";

export interface TabsListContext {
  activateOnFocus: () => boolean;
  tabsListElement: () => HTMLElement | null;
  registerIndicatorUpdateListener: (listener: () => void) => () => void;
  registerTabResizeObserverElement: (element: HTMLElement) => () => void;
}

export const TabsListContext = createContext<TabsListContext | undefined>(undefined);

export function useTabsListContext(): TabsListContext {
  const context = useContext(TabsListContext);
  if (context === undefined) {
    throw new Error("Rebase UI: TabsListContext is missing. TabsList parts must be placed within <Tabs.List>.");
  }

  return context;
}
