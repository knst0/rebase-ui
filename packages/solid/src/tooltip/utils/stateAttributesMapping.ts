import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { TransitionStatus } from "../../internals/transition-status";
import { transitionStatusMapping } from "../../internals/transition-status";
import * as TooltipArrowDataAttributes from "../arrow/TooltipArrowDataAttributes";
import * as TooltipPopupDataAttributes from "../popup/TooltipPopupDataAttributes";
import * as TooltipPositionerDataAttributes from "../positioner/TooltipPositionerDataAttributes";
import * as TooltipTriggerDataAttributes from "../trigger/TooltipTriggerDataAttributes";
import * as TooltipViewportDataAttributes from "../viewport/TooltipViewportDataAttributes";

const TRIGGER_OPEN_HOOK = { [TooltipTriggerDataAttributes.popupOpen]: "" };

export const tooltipTriggerStateMapping: StateAttributesMapping<{ open: boolean }> = {
  open: {
    keys: [TooltipTriggerDataAttributes.popupOpen],
    map: (value) => (value ? TRIGGER_OPEN_HOOK : null),
  },
};

const POPUP_OPEN_HOOK = { [TooltipPopupDataAttributes.open]: "" };
const POPUP_CLOSED_HOOK = { [TooltipPopupDataAttributes.closed]: "" };
const ANCHOR_HIDDEN_HOOK = { [TooltipPositionerDataAttributes.anchorHidden]: "" };

export const tooltipPositionerStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
}> = {
  open: {
    keys: [TooltipPositionerDataAttributes.open, TooltipPositionerDataAttributes.closed],
    map: (value) => (value ? POPUP_OPEN_HOOK : POPUP_CLOSED_HOOK),
  },
  anchorHidden: {
    keys: [TooltipPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? ANCHOR_HIDDEN_HOOK : null),
  },
};

export const tooltipPopupStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
  transitionStatus: TransitionStatus;
}> = {
  ...tooltipPositionerStateMapping,
  ...transitionStatusMapping,
};

const ARROW_OPEN_HOOK = { [TooltipArrowDataAttributes.open]: "" };
const ARROW_CLOSED_HOOK = { [TooltipArrowDataAttributes.closed]: "" };

export const tooltipArrowStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
}> = {
  open: {
    keys: [TooltipArrowDataAttributes.open, TooltipArrowDataAttributes.closed],
    map: (value) => (value ? ARROW_OPEN_HOOK : ARROW_CLOSED_HOOK),
  },
  anchorHidden: {
    keys: [TooltipPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? ANCHOR_HIDDEN_HOOK : null),
  },
};

export const tooltipViewportStateMapping: StateAttributesMapping<{
  activationDirection: string | undefined;
}> = {
  activationDirection: {
    keys: [TooltipViewportDataAttributes.activationDirection],
    map: (value) => (value ? { [TooltipViewportDataAttributes.activationDirection]: value } : null),
  },
};
