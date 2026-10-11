import type { FieldRootState } from "../../field/root/FieldRoot";

export const DEFAULT_VALIDITY_STATE = {
  badInput: false,
  customError: false,
  patternMismatch: false,
  rangeOverflow: false,
  rangeUnderflow: false,
  stepMismatch: false,
  tooLong: false,
  tooShort: false,
  typeMismatch: false,
  valid: null,
  valueMissing: false,
};

/**
 * Selector record behind the field state snapshot. Parts spread the root
 * selectors and override `disabled`, then resolve a snapshot per binding.
 */
export interface FieldRootStateSelectors {
  disabled: () => boolean;
  touched: () => boolean;
  dirty: () => boolean;
  valid: () => boolean | null;
  filled: () => boolean;
  focused: () => boolean;
  validating: () => boolean;
}

export const DEFAULT_FIELD_STATE_ATTRIBUTES: Pick<
  FieldRootStateSelectors,
  "valid" | "touched" | "dirty" | "filled" | "focused" | "validating"
> = {
  valid: () => null,
  touched: () => false,
  dirty: () => false,
  filled: () => false,
  focused: () => false,
  validating: () => false,
};

export const DEFAULT_FIELD_ROOT_STATE: FieldRootStateSelectors = {
  disabled: () => false,
  ...DEFAULT_FIELD_STATE_ATTRIBUTES,
  validating: () => false,
};

/**
 * Resolves a plain state snapshot from the selectors. Called inside JSX
 * bindings (and the state thunk passed to render functions) so each read
 * subscribes the binding to the selector it came from.
 */
export function getFieldStateSnapshot(state: FieldRootStateSelectors): FieldRootState {
  return {
    disabled: state.disabled(),
    touched: state.touched(),
    dirty: state.dirty(),
    valid: state.valid(),
    filled: state.filled(),
    focused: state.focused(),
    validating: state.validating(),
  };
}
