import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { ProgressRootState } from "./ProgressRoot";
import * as ProgressRootDataAttributes from "./ProgressRootDataAttributes";

export const progressStateAttributesMapping: StateAttributesMapping<ProgressRootState> = {
  status: {
    keys: [ProgressRootDataAttributes.progressing, ProgressRootDataAttributes.complete, ProgressRootDataAttributes.indeterminate],
    map(value): Record<string, string> | null {
      if (value === "progressing") {
        return { [ProgressRootDataAttributes.progressing]: "" };
      }
      if (value === "complete") {
        return { [ProgressRootDataAttributes.complete]: "" };
      }
      if (value === "indeterminate") {
        return { [ProgressRootDataAttributes.indeterminate]: "" };
      }
      return null;
    },
  },
};
