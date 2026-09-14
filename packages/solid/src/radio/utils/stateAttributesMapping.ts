import { fieldValidityMapping } from "../../internals/field-constants";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { RadioRootState } from "../root/RadioRoot";
import * as RadioRootDataAttributes from "../root/RadioRootDataAttributes";

export const stateAttributesMapping: StateAttributesMapping<RadioRootState> = {
  checked: {
    keys: [RadioRootDataAttributes.checked, RadioRootDataAttributes.unchecked],
    map: (value): Record<string, string> | null => {
      if (value) {
        return { [RadioRootDataAttributes.checked]: "" };
      }

      return { [RadioRootDataAttributes.unchecked]: "" };
    },
  },
  ...fieldValidityMapping,
};
