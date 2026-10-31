import type { JSX } from "reze-js";

import { useComboboxInputValueContext } from "../../combobox/root/ComboboxRootContext";
import { createScopedRender } from "../../internals/renderProps";

/**
 * The current value of the autocomplete.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Autocomplete](https://rebase-ui.knst.dev/components/autocomplete)
 */
export function AutocompleteValue(props: AutocompleteValue.Props): JSX.Element {
  const inputValue = useComboboxInputValueContext();
  const children = props.children;

  if (typeof children === "function") {
    // The render function runs once; reads of the accessor inside its JSX stay reactive.
    const value = () => String(inputValue());
    const result = (children as (value: () => string) => JSX.Element)(value);
    return createScopedRender().bindResult(result, value);
  }

  if (children != null) {
    return children as JSX.Element;
  }

  return <>{String(inputValue())}</>;
}

export interface AutocompleteValueState {}

export interface AutocompleteValueProps {
  /**
   * Replaces the input value, or a function receiving an accessor of the input value.
   */
  children?: JSX.Element | ((value: () => string) => JSX.Element);
}

export namespace AutocompleteValue {
  export type State = AutocompleteValueState;
  export type Props = AutocompleteValueProps;
}
