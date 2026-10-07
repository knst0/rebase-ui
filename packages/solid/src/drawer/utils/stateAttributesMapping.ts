import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { transitionStatusMapping } from "../../internals/transition-status";
import * as DrawerPopupDataAttributes from "../popup/DrawerPopupDataAttributes";

const OPEN_HOOK = { [DrawerPopupDataAttributes.open]: "" };
const CLOSED_HOOK = { [DrawerPopupDataAttributes.closed]: "" };
const EXPANDED_HOOK = { [DrawerPopupDataAttributes.expanded]: "" };
const NESTED_DRAWER_OPEN_HOOK = { [DrawerPopupDataAttributes.nestedDrawerOpen]: "" };
const NESTED_DRAWER_SWIPING_HOOK = { [DrawerPopupDataAttributes.nestedDrawerSwiping]: "" };
const SWIPING_HOOK = { [DrawerPopupDataAttributes.swiping]: "" };

export interface DrawerPopupSharedState {
  open: boolean;
  transitionStatus: import("../../internals/transition-status").TransitionStatus;
  expanded: boolean;
  nestedDrawerOpen: boolean;
  nestedDrawerSwiping: boolean;
  swipeDirection: string;
  swiping: boolean;
}

export const drawerPopupStateAttributesMapping: StateAttributesMapping<DrawerPopupSharedState> = {
  open: {
    keys: [DrawerPopupDataAttributes.open, DrawerPopupDataAttributes.closed],
    map: (value) => (value ? OPEN_HOOK : CLOSED_HOOK),
  },
  ...transitionStatusMapping,
  expanded: {
    keys: [DrawerPopupDataAttributes.expanded],
    map: (value) => (value ? EXPANDED_HOOK : null),
  },
  nestedDrawerOpen: {
    keys: [DrawerPopupDataAttributes.nestedDrawerOpen],
    map: (value) => (value ? NESTED_DRAWER_OPEN_HOOK : null),
  },
  nestedDrawerSwiping: {
    keys: [DrawerPopupDataAttributes.nestedDrawerSwiping],
    map: (value) => (value ? NESTED_DRAWER_SWIPING_HOOK : null),
  },
  swipeDirection: {
    keys: [DrawerPopupDataAttributes.swipeDirection],
    map: (value) => ({ [DrawerPopupDataAttributes.swipeDirection]: value }),
  },
  swiping: {
    keys: [DrawerPopupDataAttributes.swiping],
    map: (value) => (value ? SWIPING_HOOK : null),
  },
};
