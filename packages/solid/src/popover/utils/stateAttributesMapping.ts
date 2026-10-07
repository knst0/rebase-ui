import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { TransitionStatus } from "../../internals/transition-status";
import { transitionStatusMapping } from "../../internals/transition-status";
import * as PopoverArrowDataAttributes from "../arrow/PopoverArrowDataAttributes";
import * as PopoverPopupDataAttributes from "../popup/PopoverPopupDataAttributes";
import * as PopoverPositionerDataAttributes from "../positioner/PopoverPositionerDataAttributes";
import * as PopoverTriggerDataAttributes from "../trigger/PopoverTriggerDataAttributes";
import * as PopoverViewportDataAttributes from "../viewport/PopoverViewportDataAttributes";

const TRIGGER_OPEN_HOOK = { [PopoverTriggerDataAttributes.popupOpen]: "" };
const PRESSED_HOOK = { [PopoverTriggerDataAttributes.pressed]: "" };

export const popoverTriggerStateMapping: StateAttributesMapping<{ open: boolean; pressed: boolean }> = {
  open: {
    keys: [PopoverTriggerDataAttributes.popupOpen],
    map: (value) => (value ? TRIGGER_OPEN_HOOK : null),
  },
  pressed: {
    keys: [PopoverTriggerDataAttributes.pressed],
    map: (value) => (value ? PRESSED_HOOK : null),
  },
};

const POPUP_OPEN_HOOK = { [PopoverPopupDataAttributes.open]: "" };
const POPUP_CLOSED_HOOK = { [PopoverPopupDataAttributes.closed]: "" };
const ANCHOR_HIDDEN_HOOK = { [PopoverPositionerDataAttributes.anchorHidden]: "" };

export const popoverPositionerStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
}> = {
  open: {
    keys: [PopoverPositionerDataAttributes.open, PopoverPositionerDataAttributes.closed],
    map: (value) => (value ? POPUP_OPEN_HOOK : POPUP_CLOSED_HOOK),
  },
  anchorHidden: {
    keys: [PopoverPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? ANCHOR_HIDDEN_HOOK : null),
  },
};

export const popoverPopupStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
  transitionStatus: TransitionStatus;
}> = {
  ...popoverPositionerStateMapping,
  ...transitionStatusMapping,
};

const ARROW_OPEN_HOOK = { [PopoverArrowDataAttributes.open]: "" };
const ARROW_CLOSED_HOOK = { [PopoverArrowDataAttributes.closed]: "" };

export const popoverArrowStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
}> = {
  open: {
    keys: [PopoverArrowDataAttributes.open, PopoverArrowDataAttributes.closed],
    map: (value) => (value ? ARROW_OPEN_HOOK : ARROW_CLOSED_HOOK),
  },
  anchorHidden: {
    keys: [PopoverPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? ANCHOR_HIDDEN_HOOK : null),
  },
};

export const popoverViewportStateMapping: StateAttributesMapping<{
  activationDirection: string | undefined;
}> = {
  activationDirection: {
    keys: [PopoverViewportDataAttributes.activationDirection],
    map: (value) => (value ? { [PopoverViewportDataAttributes.activationDirection]: value } : null),
  },
};
