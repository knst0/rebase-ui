import type { Accessor } from "solid-js";

import type { CollapsibleRootState } from "../collapsible";
import * as CollapsiblePanelDataAttributes from "../collapsible/panel/CollapsiblePanelDataAttributes";
import * as CollapsibleTriggerDataAttributes from "../collapsible/trigger/CollapsibleTriggerDataAttributes";
import type { StateAttributesMapping } from "./stateToAttributes";
import { transitionStatusMapping } from "./transition-status";

const PANEL_OPEN_HOOK = {
  [CollapsiblePanelDataAttributes.open]: "",
};

const PANEL_CLOSED_HOOK = {
  [CollapsiblePanelDataAttributes.closed]: "",
};

export const triggerOpenStateMapping: StateAttributesMapping<CollapsibleRootState> = {
  ...transitionStatusMapping,
  open: {
    keys: [CollapsibleTriggerDataAttributes.panelOpen],
    map: (value) => (value ? { [CollapsibleTriggerDataAttributes.panelOpen]: "" } : null),
  },
};

export const collapsibleOpenStateMapping: StateAttributesMapping<{ open: Accessor<boolean> }> = {
  open: {
    keys: [CollapsiblePanelDataAttributes.open, CollapsiblePanelDataAttributes.closed],
    map: (value) => (value ? PANEL_OPEN_HOOK : PANEL_CLOSED_HOOK),
  },
};
