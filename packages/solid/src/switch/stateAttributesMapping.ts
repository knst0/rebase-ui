import { fieldValidityMapping } from "../internals/field-constants";
import type { StateAttributesMapping } from "../internals/stateToAttributes";
import type { SwitchRootState } from "./root/SwitchRoot";
import * as SwitchRootDataAttributes from "./root/SwitchRootDataAttributes";

export const stateAttributesMapping: StateAttributesMapping<SwitchRootState> = {
  ...fieldValidityMapping,
  checked: {
    keys: [SwitchRootDataAttributes.checked, SwitchRootDataAttributes.unchecked],
    map: (value): Record<string, string> | null => {
      if (value) {
        return { [SwitchRootDataAttributes.checked]: "" };
      }

      return { [SwitchRootDataAttributes.unchecked]: "" };
    },
  },
};
