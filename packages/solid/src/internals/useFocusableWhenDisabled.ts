import type { Accessor } from "solid-js";

export interface FocusableWhenDisabledProps {
  "aria-disabled"?: "true" | "false" | undefined;
  disabled?: boolean | undefined;
  onKeyDown: (event: KeyboardEvent) => void;
  tabIndex?: number | undefined;
}

export interface UseFocusableWhenDisabledParameters {
  /**
   * Whether the component should be focusable when disabled.
   * When `undefined`, composite items are focusable when disabled by default.
   */
  focusableWhenDisabled?: Accessor<boolean | undefined>;
  /**
   * The disabled state of the component.
   */
  disabled: Accessor<boolean>;
  /**
   * Whether this is a composite item or not.
   * @default false
   */
  composite?: Accessor<boolean | undefined>;
  /**
   * @default 0
   */
  tabIndex?: Accessor<number | undefined>;
  /**
   * @default true
   */
  isNativeButton: Accessor<boolean>;
}

export interface UseFocusableWhenDisabledReturnValue {
  props: FocusableWhenDisabledProps;
}

export function useFocusableWhenDisabled(parameters: UseFocusableWhenDisabledParameters): UseFocusableWhenDisabledReturnValue {
  const { disabled, isNativeButton } = parameters;
  const focusableWhenDisabled = () => parameters.focusableWhenDisabled?.();
  const composite = () => parameters.composite?.() ?? false;
  const tabIndex = () => parameters.tabIndex?.() ?? 0;

  const isFocusableComposite = () => composite() && focusableWhenDisabled() !== false;
  const isNonFocusableComposite = () => composite() && focusableWhenDisabled() === false;

  const props: FocusableWhenDisabledProps = {
    onKeyDown: (event) => {
      if (disabled() && focusableWhenDisabled() && event.key !== "Tab") {
        event.preventDefault();
      }
    },
  };

  defineProp(props, "tabIndex", () => {
    if (composite()) {
      return undefined;
    }
    if (!isNativeButton() && disabled()) {
      return focusableWhenDisabled() ? tabIndex() : -1;
    }
    return tabIndex();
  });

  defineProp(props, "aria-disabled", () => {
    if ((isNativeButton() && (focusableWhenDisabled() || isFocusableComposite())) || (!isNativeButton() && disabled())) {
      return disabled() ? "true" : "false";
    }
    return undefined;
  });

  defineProp(props, "disabled", () => {
    if (isNativeButton() && (!focusableWhenDisabled() || isNonFocusableComposite())) {
      return disabled();
    }
    return undefined;
  });

  return { props };
}

function defineProp(target: FocusableWhenDisabledProps, key: keyof FocusableWhenDisabledProps, get: () => any) {
  Object.defineProperty(target, key, { enumerable: true, configurable: true, get });
}
