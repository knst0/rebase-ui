import type { JSX } from "@solidjs/web";
import { untrack, type Accessor } from "solid-js";

import { useComboboxInputValueContext } from "../../combobox/root/ComboboxRootContext";

/**
 * The current value of the autocomplete.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Autocomplete](https://rebase-ui.knst.dev/components/autocomplete)
 */
export function AutocompleteValue(props: AutocompleteValue.Props): JSX.Element {
  const inputValue = useComboboxInputValueContext();
  const children = untrack(() => props.children);

  if (typeof children === "function") {
    // The render function runs once; reads of the accessor inside its JSX stay reactive.
    const value: Accessor<string> = () => String(inputValue());
    return untrack(() => (children as (value: Accessor<string>) => JSX.Element)(value));
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
  children?: JSX.Element | ((value: Accessor<string>) => JSX.Element);
}

export namespace AutocompleteValue {
  export type State = AutocompleteValueState;
  export type Props = AutocompleteValueProps;
}
