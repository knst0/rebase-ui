import { fieldValidityMapping } from "../../internals/field-constants";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { NumberFieldRootState } from "../root/NumberFieldRoot";

const nullMapping = { keys: [], map: () => null };

export const stateAttributesMapping: StateAttributesMapping<NumberFieldRootState> = {
  inputValue: nullMapping,
  value: nullMapping,
  ...fieldValidityMapping,
};
