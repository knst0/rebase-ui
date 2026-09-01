import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { TabsRootState } from "./TabsRoot";
import * as TabsRootDataAttributes from "./TabsRootDataAttributes";

export const tabsStateAttributesMapping: StateAttributesMapping<TabsRootState> = {
  tabActivationDirection: (direction) => ({
    [TabsRootDataAttributes.activationDirection]: direction,
  }),
};
