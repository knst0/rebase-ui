import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { transitionStatusMapping } from "../../internals/transition-status";
import type { TransitionStatus } from "../../internals/transition-status";
import * as ToastActionDataAttributes from "../action/ToastActionDataAttributes";
import * as ToastCloseDataAttributes from "../close/ToastCloseDataAttributes";
import * as ToastContentDataAttributes from "../content/ToastContentDataAttributes";
import * as ToastDescriptionDataAttributes from "../description/ToastDescriptionDataAttributes";
import * as ToastPositionerDataAttributes from "../positioner/ToastPositionerDataAttributes";
import * as ToastRootDataAttributes from "../root/ToastRootDataAttributes";
import * as ToastTitleDataAttributes from "../title/ToastTitleDataAttributes";
import * as ToastViewportDataAttributes from "../viewport/ToastViewportDataAttributes";

export const toastRootStateAttributesMapping: StateAttributesMapping<{
  transitionStatus: TransitionStatus;
  swipeDirection: "up" | "down" | "left" | "right" | undefined;
}> = {
  ...transitionStatusMapping,
  swipeDirection: {
    keys: [ToastRootDataAttributes.swipeDirection],
    map: (value) => (value ? { [ToastRootDataAttributes.swipeDirection]: value } : null),
  },
};

const TYPE_HOOK = (attributes: Record<string, string>) => ({
  keys: [attributes.type],
  map: (value: string | undefined) => (value ? { [attributes.type]: value } : null),
});

export const toastTitleStateMapping: StateAttributesMapping<{ type: string | undefined }> = {
  type: TYPE_HOOK(ToastTitleDataAttributes),
};

export const toastDescriptionStateMapping: StateAttributesMapping<{ type: string | undefined }> = {
  type: TYPE_HOOK(ToastDescriptionDataAttributes),
};

export const toastCloseStateMapping: StateAttributesMapping<{ type: string | undefined }> = {
  type: TYPE_HOOK(ToastCloseDataAttributes),
};

export const toastActionStateMapping: StateAttributesMapping<{ type: string | undefined }> = {
  type: TYPE_HOOK(ToastActionDataAttributes),
};

export const toastContentStateMapping: StateAttributesMapping<{ expanded: boolean; behind: boolean }> = {
  expanded: {
    keys: [ToastContentDataAttributes.expanded],
    map: (value) => (value ? { [ToastContentDataAttributes.expanded]: "" } : null),
  },
  behind: {
    keys: [ToastContentDataAttributes.behind],
    map: (value) => (value ? { [ToastContentDataAttributes.behind]: "" } : null),
  },
};

export const toastViewportStateMapping: StateAttributesMapping<{ expanded: boolean }> = {
  expanded: {
    keys: [ToastViewportDataAttributes.expanded],
    map: (value) => (value ? { [ToastViewportDataAttributes.expanded]: "" } : null),
  },
};

export const toastPositionerStateMapping: StateAttributesMapping<{ anchorHidden: boolean }> = {
  anchorHidden: {
    keys: [ToastPositionerDataAttributes.anchorHidden],
    map: (value) => (value ? { [ToastPositionerDataAttributes.anchorHidden]: "" } : null),
  },
};

/**
 * `side`, `align` and `uncentered` need no explicit mapping: unmapped values
 * already render as `data-side`, `data-align` and `data-uncentered`.
 */
