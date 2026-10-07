import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { TransitionStatus } from "../../internals/transition-status";
import { transitionStatusMapping } from "../../internals/transition-status";
import * as MenuArrowDataAttributes from "../arrow/MenuArrowDataAttributes";
import * as MenuCheckboxItemDataAttributes from "../checkbox-item/MenuCheckboxItemDataAttributes";
import * as MenuItemDataAttributes from "../item/MenuItemDataAttributes";
import * as MenuPopupDataAttributes from "../popup/MenuPopupDataAttributes";
import * as MenuPositionerDataAttributes from "../positioner/MenuPositionerDataAttributes";
import * as MenuSubmenuTriggerDataAttributes from "../submenu-trigger/MenuSubmenuTriggerDataAttributes";
import * as MenuTriggerDataAttributes from "../trigger/MenuTriggerDataAttributes";
import * as MenuViewportDataAttributes from "../viewport/MenuViewportDataAttributes";

const TRIGGER_OPEN_HOOK = { [MenuTriggerDataAttributes.popupOpen]: "" };
const TRIGGER_PRESSED_HOOK = { [MenuTriggerDataAttributes.pressed]: "" };

export const menuTriggerStateMapping: StateAttributesMapping<{ open: boolean }> = {
  open: {
    keys: [MenuTriggerDataAttributes.popupOpen],
    map: (value) => (value ? TRIGGER_OPEN_HOOK : null),
  },
};

export const menuPressableTriggerStateMapping: StateAttributesMapping<{ open: boolean }> = {
  open: {
    keys: [MenuTriggerDataAttributes.popupOpen, MenuTriggerDataAttributes.pressed],
    map: (value) => (value ? { ...TRIGGER_OPEN_HOOK, ...TRIGGER_PRESSED_HOOK } : null),
  },
};

export const menuSubmenuTriggerStateMapping: StateAttributesMapping<{ open: boolean }> = {
  open: {
    keys: [MenuSubmenuTriggerDataAttributes.popupOpen],
    map: (value) => (value ? { [MenuSubmenuTriggerDataAttributes.popupOpen]: "" } : null),
  },
};

const POPUP_OPEN_HOOK = { [MenuPopupDataAttributes.open]: "" };
const POPUP_CLOSED_HOOK = { [MenuPopupDataAttributes.closed]: "" };
const ANCHOR_HIDDEN_HOOK = { [MenuPositionerDataAttributes.anchorHidden]: "" };

export const menuPositionerStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
}> = {
  open: {
    keys: [MenuPositionerDataAttributes.open, MenuPositionerDataAttributes.closed],
    map: (value) => (value ? POPUP_OPEN_HOOK : POPUP_CLOSED_HOOK),
  },
  anchorHidden: {
    keys: [MenuPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? ANCHOR_HIDDEN_HOOK : null),
  },
};

export const menuPopupStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
  transitionStatus: TransitionStatus;
}> = {
  ...menuPositionerStateMapping,
  ...transitionStatusMapping,
};

const ARROW_OPEN_HOOK = { [MenuArrowDataAttributes.open]: "" };
const ARROW_CLOSED_HOOK = { [MenuArrowDataAttributes.closed]: "" };

export const menuArrowStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
}> = {
  open: {
    keys: [MenuArrowDataAttributes.open, MenuArrowDataAttributes.closed],
    map: (value) => (value ? ARROW_OPEN_HOOK : ARROW_CLOSED_HOOK),
  },
  anchorHidden: {
    keys: [MenuPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? ANCHOR_HIDDEN_HOOK : null),
  },
};

const ITEM_DISABLED_HOOK = { [MenuItemDataAttributes.disabled]: "" };
const ITEM_HIGHLIGHTED_HOOK = { [MenuItemDataAttributes.highlighted]: "" };

export const menuItemStateMapping: StateAttributesMapping<{ disabled: boolean; highlighted: boolean }> = {
  disabled: {
    keys: [MenuItemDataAttributes.disabled],
    map: (value) => (value ? ITEM_DISABLED_HOOK : null),
  },
  highlighted: {
    keys: [MenuItemDataAttributes.highlighted],
    map: (value) => (value ? ITEM_HIGHLIGHTED_HOOK : null),
  },
};

const CHECKED_HOOK = { [MenuCheckboxItemDataAttributes.checked]: "" };
const UNCHECKED_HOOK = { [MenuCheckboxItemDataAttributes.unchecked]: "" };

export const menuCheckableItemStateMapping: StateAttributesMapping<{
  checked: boolean;
  transitionStatus: TransitionStatus;
}> = {
  checked: {
    keys: [MenuCheckboxItemDataAttributes.checked, MenuCheckboxItemDataAttributes.unchecked],
    map: (value) => (value ? CHECKED_HOOK : UNCHECKED_HOOK),
  },
  ...transitionStatusMapping,
};

export const menuViewportStateMapping: StateAttributesMapping<{
  activationDirection: string | undefined;
}> = {
  activationDirection: {
    keys: [MenuViewportDataAttributes.activationDirection],
    map: (value) => (value ? { [MenuViewportDataAttributes.activationDirection]: value } : null),
  },
};
