export interface FocusableWhenDisabledProps {
  "aria-disabled"?: "true" | "false" | undefined;
  disabled?: boolean | undefined;
  tabIndex?: number | undefined;
}

export interface CreateFocusableWhenDisabledPropsParameters {
  /**
   * Whether the component should be focusable when disabled.
   */
  focusableWhenDisabled: boolean | undefined;
  /**
   * The disabled state of the component.
   */
  disabled: boolean;
  /**
   * Whether this is a native button or not.
   * @default true
   */
  isNativeButton: boolean;
}

/**
 * Snapshot of the disabled-related attributes for the current props. Unlike the Solid
 * version, this takes plain values instead of accessors: callers read reactive props
 * directly in the call arguments inside a JSX binding, so the binding stays reactive.
 */
export function createFocusableWhenDisabledProps(parameters: CreateFocusableWhenDisabledPropsParameters): FocusableWhenDisabledProps {
  const { disabled, focusableWhenDisabled, isNativeButton } = parameters;

  let tabIndex: number | undefined;
  if (isNativeButton || !disabled || focusableWhenDisabled) {
    tabIndex = 0;
  } else {
    tabIndex = -1;
  }

  let ariaDisabled: "true" | "false" | undefined;
  if ((isNativeButton && focusableWhenDisabled) || (!isNativeButton && disabled)) {
    ariaDisabled = disabled ? "true" : "false";
  }

  let disabledAttribute: boolean | undefined;
  if (isNativeButton && !focusableWhenDisabled) {
    disabledAttribute = disabled;
  }

  return {
    "aria-disabled": ariaDisabled,
    disabled: disabledAttribute,
    tabIndex,
  };
}
