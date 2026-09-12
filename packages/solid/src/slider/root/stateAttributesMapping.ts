import { fieldValidityMapping } from "../../internals/field-constants";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { SliderRootState } from "./SliderRoot";

const nullMapping = { keys: [], map: () => null };

export const sliderStateAttributesMapping: StateAttributesMapping<SliderRootState> = {
  activeThumbIndex: nullMapping,
  max: nullMapping,
  min: nullMapping,
  minStepsBetweenValues: nullMapping,
  step: nullMapping,
  values: nullMapping,
  ...fieldValidityMapping,
};
