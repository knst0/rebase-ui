import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { transitionStatusMapping } from "../../internals/transition-status";
import type { TransitionStatus } from "../../internals/transition-status";
import * as DialogPopupDataAttributes from "../popup/DialogPopupDataAttributes";
import * as DialogTriggerDataAttributes from "../trigger/DialogTriggerDataAttributes";

export interface DialogSharedState {
  open: boolean;
  transitionStatus: TransitionStatus;
  nested: boolean;
  nestedDialogOpen: boolean;
}

const OPEN_HOOK = { [DialogPopupDataAttributes.open]: "" };
const CLOSED_HOOK = { [DialogPopupDataAttributes.closed]: "" };
const NESTED_DIALOG_OPEN_HOOK = { [DialogPopupDataAttributes.nestedDialogOpen]: "" };
const POPUP_OPEN_HOOK = { [DialogTriggerDataAttributes.popupOpen]: "" };

export const dialogTransitionStateMapping: StateAttributesMapping<{
  open: boolean;
  transitionStatus: TransitionStatus;
}> = {
  open: {
    keys: [DialogPopupDataAttributes.open, DialogPopupDataAttributes.closed],
    map: (value) => (value ? OPEN_HOOK : CLOSED_HOOK),
  },
  ...transitionStatusMapping,
};

/**
 * Shared by `Dialog.Popup` and `Dialog.Viewport`, whose states have the same shape.
 * `nested` is not mapped: unmapped `true` booleans already render as `data-nested`.
 */
export const dialogStateAttributesMapping: StateAttributesMapping<DialogSharedState> = {
  ...dialogTransitionStateMapping,
  nestedDialogOpen: {
    keys: [DialogPopupDataAttributes.nestedDialogOpen],
    map: (value) => (value ? NESTED_DIALOG_OPEN_HOOK : null),
  },
};

export const dialogTriggerStateMapping: StateAttributesMapping<{ open: boolean }> = {
  open: {
    keys: [DialogTriggerDataAttributes.popupOpen],
    map: (value) => (value ? POPUP_OPEN_HOOK : null),
  },
};
