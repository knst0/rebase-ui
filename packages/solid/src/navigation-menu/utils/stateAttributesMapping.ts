import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { transitionStatusMapping, type TransitionStatus } from "../../internals/transition-status";

const OPEN_HOOK = { "data-open": "" };
const CLOSED_HOOK = { "data-closed": "" };
const ANCHOR_HIDDEN_HOOK = { "data-anchor-hidden": "" };
const TRIGGER_HOOK = { "data-popup-open": "" };
const PRESSABLE_TRIGGER_HOOK = { "data-popup-open": "", "data-pressed": "" };

export const popupStateMapping = {
  open: {
    keys: ["data-open", "data-closed"],
    map: (value) => (value ? OPEN_HOOK : CLOSED_HOOK),
  },
  anchorHidden: {
    keys: ["data-anchor-hidden"],
    map: (value) => (value ? ANCHOR_HIDDEN_HOOK : null),
  },
} satisfies StateAttributesMapping<{ open: boolean; anchorHidden: boolean }>;

export const popupTransitionStateMapping = {
  ...popupStateMapping,
  ...transitionStatusMapping,
} satisfies StateAttributesMapping<{ open: boolean; anchorHidden: boolean; transitionStatus: TransitionStatus }>;

export const triggerOpenStateMapping = {
  open: {
    keys: ["data-popup-open"],
    map: (value) => (value ? TRIGGER_HOOK : null),
  },
} satisfies StateAttributesMapping<{ open: boolean }>;

export const pressableTriggerOpenStateMapping = {
  open: {
    keys: ["data-popup-open", "data-pressed"],
    map: (value) => (value ? PRESSABLE_TRIGGER_HOOK : null),
  },
} satisfies StateAttributesMapping<{ open: boolean }>;
