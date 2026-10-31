import type { ComboboxTriggerProps, ComboboxTriggerState } from "../../combobox/trigger/ComboboxTrigger";
import { ComboboxTrigger } from "../../combobox/trigger/ComboboxTrigger";

/**
 * Documentation: [Rebase UI Autocomplete](https://rebase-ui.knst.dev/components/autocomplete)
 */
export const AutocompleteTrigger = ComboboxTrigger;

export type AutocompleteTriggerState = ComboboxTriggerState;
export type AutocompleteTriggerProps = ComboboxTriggerProps;

export namespace AutocompleteTrigger {
  export type State = AutocompleteTriggerState;
  export type Props = AutocompleteTriggerProps;
}
