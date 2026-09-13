import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { transitionStatusMapping } from "../../internals/transition-status";
import type { TransitionStatus } from "../../internals/transition-status";
import * as SelectArrowDataAttributes from "../arrow/SelectArrowDataAttributes";
import * as SelectBackdropDataAttributes from "../backdrop/SelectBackdropDataAttributes";
import * as SelectPopupDataAttributes from "../popup/SelectPopupDataAttributes";
import * as SelectPositionerDataAttributes from "../positioner/SelectPositionerDataAttributes";

const POSITIONER_OPEN_HOOK = { [SelectPositionerDataAttributes.open]: "" };
const POSITIONER_CLOSED_HOOK = { [SelectPositionerDataAttributes.closed]: "" };
const POSITIONER_ANCHOR_HIDDEN_HOOK = { [SelectPositionerDataAttributes.anchorHidden]: "" };

export const selectPositionerStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
}> = {
  open: {
    keys: [SelectPositionerDataAttributes.open, SelectPositionerDataAttributes.closed],
    map: (value) => (value ? POSITIONER_OPEN_HOOK : POSITIONER_CLOSED_HOOK),
  },
  anchorHidden: {
    keys: [SelectPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? POSITIONER_ANCHOR_HIDDEN_HOOK : null),
  },
};

const POPUP_OPEN_HOOK = { [SelectPopupDataAttributes.open]: "" };
const POPUP_CLOSED_HOOK = { [SelectPopupDataAttributes.closed]: "" };
const POPUP_ANCHOR_HIDDEN_HOOK = { [SelectPositionerDataAttributes.anchorHidden]: "" };

export const selectPopupStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
  transitionStatus: TransitionStatus;
}> = {
  open: {
    keys: [SelectPopupDataAttributes.open, SelectPopupDataAttributes.closed],
    map: (value) => (value ? POPUP_OPEN_HOOK : POPUP_CLOSED_HOOK),
  },
  anchorHidden: {
    keys: [SelectPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? POPUP_ANCHOR_HIDDEN_HOOK : null),
  },
  ...transitionStatusMapping,
};

const ARROW_OPEN_HOOK = { [SelectArrowDataAttributes.open]: "" };
const ARROW_CLOSED_HOOK = { [SelectArrowDataAttributes.closed]: "" };
const ARROW_ANCHOR_HIDDEN_HOOK = { [SelectPositionerDataAttributes.anchorHidden]: "" };

export const selectArrowStateMapping: StateAttributesMapping<{
  open: boolean;
  anchorHidden: boolean;
}> = {
  open: {
    keys: [SelectArrowDataAttributes.open, SelectArrowDataAttributes.closed],
    map: (value) => (value ? ARROW_OPEN_HOOK : ARROW_CLOSED_HOOK),
  },
  anchorHidden: {
    keys: [SelectPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? ARROW_ANCHOR_HIDDEN_HOOK : null),
  },
};

const BACKDROP_OPEN_HOOK = { [SelectBackdropDataAttributes.open]: "" };

export const selectBackdropStateMapping: StateAttributesMapping<{
  open: boolean;
  transitionStatus: TransitionStatus;
}> = {
  open: {
    keys: [SelectBackdropDataAttributes.open, SelectBackdropDataAttributes.closed],
    map: (value) => (value ? BACKDROP_OPEN_HOOK : null),
  },
  ...transitionStatusMapping,
};
