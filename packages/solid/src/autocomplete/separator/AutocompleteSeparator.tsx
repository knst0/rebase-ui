import type { ComboboxSeparatorProps, ComboboxSeparatorState } from "../../combobox/separator/ComboboxSeparator";
import { ComboboxSeparator } from "../../combobox/separator/ComboboxSeparator";

/**
 * Documentation: [Rebase UI Autocomplete](https://rebase-ui.knst.dev/components/autocomplete)
 */
export const AutocompleteSeparator = ComboboxSeparator;

export type AutocompleteSeparatorState = ComboboxSeparatorState;
export type AutocompleteSeparatorProps = ComboboxSeparatorProps;

export namespace AutocompleteSeparator {
  export type State = AutocompleteSeparatorState;
  export type Props = AutocompleteSeparatorProps;
}
