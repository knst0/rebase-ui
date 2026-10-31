import type { ComboboxInputGroupProps, ComboboxInputGroupState } from "../../combobox/input-group/ComboboxInputGroup";
import { ComboboxInputGroup } from "../../combobox/input-group/ComboboxInputGroup";

/**
 * Documentation: [Rebase UI Autocomplete](https://rebase-ui.knst.dev/components/autocomplete)
 */
export const AutocompleteInputGroup = ComboboxInputGroup;

export type AutocompleteInputGroupState = ComboboxInputGroupState;
export type AutocompleteInputGroupProps = ComboboxInputGroupProps;

export namespace AutocompleteInputGroup {
  export type State = AutocompleteInputGroupState;
  export type Props = AutocompleteInputGroupProps;
}
