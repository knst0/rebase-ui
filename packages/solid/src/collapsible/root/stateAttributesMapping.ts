import { collapsibleOpenStateMapping as baseMapping } from "../../internals/collapsibleOpenStateMapping";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import { transitionStatusMapping } from "../../internals/transition-status";
import type { CollapsibleRootState } from "./CollapsibleRoot";

export const collapsibleStateAttributesMapping: StateAttributesMapping<CollapsibleRootState> = {
  ...baseMapping,
  ...transitionStatusMapping,
};
