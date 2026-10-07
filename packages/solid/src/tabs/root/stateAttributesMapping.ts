import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { TabsRootState } from "./TabsRoot";
import * as TabsRootDataAttributes from "./TabsRootDataAttributes";

export const tabsStateAttributesMapping: StateAttributesMapping<TabsRootState> = {
  tabActivationDirection: {
    keys: [TabsRootDataAttributes.activationDirection],
    map: (direction) => ({ [TabsRootDataAttributes.activationDirection]: direction }),
  },
};
