import { fieldValidityMapping } from "../../internals/field-constants";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { CheckboxRootState } from "../root/CheckboxRoot";
import * as CheckboxRootDataAttributes from "../root/CheckboxRootDataAttributes";

export function getCheckboxStateAttributesMapping(state: CheckboxRootState): StateAttributesMapping<CheckboxRootState> {
  return {
    checked: {
      keys: [CheckboxRootDataAttributes.checked, CheckboxRootDataAttributes.unchecked],
      map: (value): Record<string, string> | null => {
        if (state.indeterminate()) {
          return null;
        }

        if (value) {
          return { [CheckboxRootDataAttributes.checked]: "" };
        }

        return { [CheckboxRootDataAttributes.unchecked]: "" };
      },
    },
    ...fieldValidityMapping,
  };
}
