import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../internals/context";

export interface TabsListContext {
  activateOnFocus: Accessor<boolean>;
  tabsListElement: Accessor<HTMLElement | null>;
  registerIndicatorUpdateListener: (listener: () => void) => () => void;
  registerTabResizeObserverElement: (element: HTMLElement) => () => void;
}

export const TabsListContext = createContext<TabsListContext>();

export function useTabsListContext(): TabsListContext {
  const context = useContext(TabsListContext);
  if (context === undefined) {
    throw new Error("Rebase UI: TabsListContext is missing. TabsList parts must be placed within <Tabs.List>.");
  }

  return context;
}
