import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { TransitionStatus } from "../../internals/transition-status";
import { transitionStatusMapping } from "../../internals/transition-status";
import * as PreviewCardArrowDataAttributes from "../arrow/PreviewCardArrowDataAttributes";
import * as PreviewCardPopupDataAttributes from "../popup/PreviewCardPopupDataAttributes";
import * as PreviewCardPositionerDataAttributes from "../positioner/PreviewCardPositionerDataAttributes";
import * as PreviewCardTriggerDataAttributes from "../trigger/PreviewCardTriggerDataAttributes";
import * as PreviewCardViewportDataAttributes from "../viewport/PreviewCardViewportDataAttributes";

const TRIGGER_OPEN_HOOK = { [PreviewCardTriggerDataAttributes.popupOpen]: "" };

export const previewCardTriggerStateMapping: StateAttributesMapping<{ open: boolean }> = {
  open: {
    keys: [PreviewCardTriggerDataAttributes.popupOpen],
    map: (value) => (value ? TRIGGER_OPEN_HOOK : null),
  },
};

const POPUP_OPEN_HOOK = { [PreviewCardPopupDataAttributes.open]: "" };
const POPUP_CLOSED_HOOK = { [PreviewCardPopupDataAttributes.closed]: "" };
const ANCHOR_HIDDEN_HOOK = { [PreviewCardPositionerDataAttributes.anchorHidden]: "" };

export const previewCardPositionerStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
}> = {
  open: {
    keys: [PreviewCardPositionerDataAttributes.open, PreviewCardPositionerDataAttributes.closed],
    map: (value) => (value ? POPUP_OPEN_HOOK : POPUP_CLOSED_HOOK),
  },
  anchorHidden: {
    keys: [PreviewCardPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? ANCHOR_HIDDEN_HOOK : null),
  },
};

export const previewCardPopupStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
  transitionStatus: TransitionStatus;
}> = {
  ...previewCardPositionerStateMapping,
  ...transitionStatusMapping,
};

const ARROW_OPEN_HOOK = { [PreviewCardArrowDataAttributes.open]: "" };
const ARROW_CLOSED_HOOK = { [PreviewCardArrowDataAttributes.closed]: "" };

export const previewCardArrowStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
}> = {
  open: {
    keys: [PreviewCardArrowDataAttributes.open, PreviewCardArrowDataAttributes.closed],
    map: (value) => (value ? ARROW_OPEN_HOOK : ARROW_CLOSED_HOOK),
  },
  anchorHidden: {
    keys: [PreviewCardPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? ANCHOR_HIDDEN_HOOK : null),
  },
};

export const previewCardViewportStateMapping: StateAttributesMapping<{
  activationDirection: string | undefined;
}> = {
  activationDirection: {
    keys: [PreviewCardViewportDataAttributes.activationDirection],
    map: (value) => (value ? { [PreviewCardViewportDataAttributes.activationDirection]: value } : null),
  },
};
