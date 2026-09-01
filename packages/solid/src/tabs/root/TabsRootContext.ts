import type { Accessor } from "solid-js";

import type { CompositeItemMetadata } from "../../internals/composite";
import { createContext, useContext } from "../../internals/context";
import type { Orientation } from "../../internals/types";
import type { TabsTab } from "../tab/TabsTab";
import type { TabsRootChangeEventDetails } from "./TabsRoot";

export interface TabsRootContext {
  /**
   * The currently active tab's value.
   */
  value: Accessor<TabsTab.Value>;
  /**
   * Callback for setting new value.
   */
  onValueChange: (value: TabsTab.Value, eventDetails: TabsRootChangeEventDetails) => void;
  /**
   * The component orientation (layout flow direction).
   */
  orientation: Accessor<Orientation>;
  /**
   * The position of the active tab relative to the previously active tab.
   */
  tabActivationDirection: Accessor<TabsTab.ActivationDirection>;
  /**
   * Gets the element of the Tab with the given value.
   */
  getTabElementBySelectedValue: (selectedValue: TabsTab.Value) => HTMLElement | null;
  /**
   * Gets the `id` attribute of the Tab that corresponds to the given TabPanel value.
   */
  getTabIdByPanelValue: (panelValue: TabsTab.Value) => string | undefined;
  /**
   * Gets the `id` attribute of the TabPanel that corresponds to the given Tab value.
   */
  getTabPanelIdByValue: (tabValue: TabsTab.Value) => string | undefined;
  registerMountedTabPanel: (panelValue: TabsTab.Value, panelId: string) => () => void;
  registerTabPanelElement: (element: HTMLElement) => () => void;
  getTabPanelIndex: (element: HTMLElement | null) => number;
  setTabMap: (map: Map<HTMLElement, CompositeItemMetadata>) => void;
}

export const TabsRootContext = createContext<TabsRootContext>();

export function useTabsRootContext(): TabsRootContext {
  const context = useContext(TabsRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: TabsRootContext is missing. Tabs parts must be placed within <Tabs.Root>.");
  }

  return context;
}
