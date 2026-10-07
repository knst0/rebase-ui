import { fieldValidityMapping } from "../../internals/field-constants";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { OTPFieldInputState } from "../input/OTPFieldInput";
import type { OTPFieldRootState } from "../root/OTPFieldRoot";

const nullMapping = { keys: [], map: () => null };

export const rootStateAttributesMapping: StateAttributesMapping<OTPFieldRootState> = {
  value: nullMapping,
  length: nullMapping,
  ...fieldValidityMapping,
};

export const inputStateAttributesMapping: StateAttributesMapping<OTPFieldInputState> = {
  value: nullMapping,
  index: nullMapping,
  ...fieldValidityMapping,
};
