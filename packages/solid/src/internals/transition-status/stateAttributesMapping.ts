import type { StateAttributesMapping } from "../stateToAttributes";
import type { TransitionStatus } from "./createTransitionStatus";
import * as TransitionStatusDataAttributes from "./TransitionStatusDataAttributes";

const STARTING_HOOK = { [TransitionStatusDataAttributes.startingStyle]: "" };
const ENDING_HOOK = { [TransitionStatusDataAttributes.endingStyle]: "" };

export const transitionStatusMapping = {
  transitionStatus: {
    keys: [TransitionStatusDataAttributes.startingStyle, TransitionStatusDataAttributes.endingStyle],
    map(value): Record<string, string> | null {
      if (value === "starting") {
        return STARTING_HOOK;
      }
      if (value === "ending") {
        return ENDING_HOOK;
      }
      return null;
    },
  },
} satisfies StateAttributesMapping<{ transitionStatus: TransitionStatus }>;
