export interface FocusableWhenDisabledProps {
  "aria-disabled"?: "true" | "false" | undefined;
  disabled?: boolean | undefined;
  onKeyDown: (event: KeyboardEvent) => void;
  tabIndex?: number | undefined;
}

export interface CreateFocusableWhenDisabledPropsParameters {
  /**
   * Whether the component should be focusable when disabled.
   * When `undefined`, composite items are focusable when disabled by default.
   */
  focusableWhenDisabled?: (() => boolean | undefined) | undefined;
  /**
   * The disabled state of the component.
   */
  disabled: () => boolean;
  /**
   * Whether this is a composite item or not.
   * @default false
   */
  composite?: (() => boolean | undefined) | undefined;
  /**
   * @default 0
   */
  tabIndex?: (() => number | undefined) | undefined;
  /**
   * @default true
   */
  isNativeButton: () => boolean;
}

export function createFocusableWhenDisabledProps(parameters: CreateFocusableWhenDisabledPropsParameters): FocusableWhenDisabledProps {
  const { disabled, isNativeButton } = parameters;
  const focusableWhenDisabled = () => parameters.focusableWhenDisabled?.();
  const composite = () => parameters.composite?.() ?? false;
  const tabIndex = () => parameters.tabIndex?.() ?? 0;

  const isFocusableComposite = () => composite() && focusableWhenDisabled() !== false;
  const isNonFocusableComposite = () => composite() && focusableWhenDisabled() === false;

  return {
    onKeyDown(event) {
      if (disabled() && focusableWhenDisabled() && event.key !== "Tab") {
        event.preventDefault();
      }
    },

    get tabIndex() {
      if (composite()) {
        return undefined;
      }
      if (!isNativeButton() && disabled()) {
        return focusableWhenDisabled() ? tabIndex() : -1;
      }
      return tabIndex();
    },

    get "aria-disabled"() {
      if ((isNativeButton() && (focusableWhenDisabled() || isFocusableComposite())) || (!isNativeButton() && disabled())) {
        return disabled() ? "true" : "false";
      }
      return undefined;
    },

    get disabled() {
      if (isNativeButton() && (!focusableWhenDisabled() || isNonFocusableComposite())) {
        return disabled();
      }
      return undefined;
    },
  };
}
