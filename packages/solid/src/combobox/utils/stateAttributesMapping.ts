import { fieldValidityMapping } from '../../internals/field-constants';
import type { StateAttributesMapping } from '../../internals/stateToAttributes';
import type { Side } from '../../internals/anchor-positioning/createAnchorPositioning';
import * as ComboboxInputDataAttributes from '../input/ComboboxInputDataAttributes';

const OPEN_HOOK = { [ComboboxInputDataAttributes.popupOpen]: '' };
const LIST_EMPTY_HOOK = { [ComboboxInputDataAttributes.listEmpty]: '' };
const PLACEHOLDER_ATTRIBUTE = 'data-placeholder';
const PLACEHOLDER_HOOK = { [PLACEHOLDER_ATTRIBUTE]: '' };

export const triggerStateAttributesMapping: StateAttributesMapping<{
  open: boolean;
  valid: boolean | null;
  popupSide: Side | null;
  listEmpty: boolean;
  placeholder: boolean;
}> = {
  open: {
    keys: [ComboboxInputDataAttributes.popupOpen],
    map: (value) => (value ? OPEN_HOOK : null),
  },
  ...fieldValidityMapping,
  popupSide: {
    keys: [ComboboxInputDataAttributes.popupSide],
    map: (side) => (side ? { [ComboboxInputDataAttributes.popupSide]: side } : null),
  },
  listEmpty: {
    keys: [ComboboxInputDataAttributes.listEmpty],
    map: (empty) => (empty ? LIST_EMPTY_HOOK : null),
  },
  placeholder: {
    keys: [PLACEHOLDER_ATTRIBUTE],
    map: (value) => (value ? PLACEHOLDER_HOOK : null),
  },
};
