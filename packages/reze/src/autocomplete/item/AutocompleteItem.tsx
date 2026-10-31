import type { ComboboxItemProps, ComboboxItemState } from "../../combobox/item/ComboboxItem";
import { ComboboxItem } from "../../combobox/item/ComboboxItem";

/**
 * Documentation: [Rebase UI Autocomplete](https://rebase-ui.knst.dev/components/autocomplete)
 */
export const AutocompleteItem = ComboboxItem;

export type AutocompleteItemState = ComboboxItemState;
export type AutocompleteItemProps = ComboboxItemProps;

export namespace AutocompleteItem {
  export type State = AutocompleteItemState;
  export type Props = AutocompleteItemProps;
}
