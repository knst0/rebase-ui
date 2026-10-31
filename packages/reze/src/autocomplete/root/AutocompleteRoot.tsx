import { effect, omitProps, store as createStore, untrack, type JSX } from "reze-js";

import { AriaCombobox } from "../../combobox/root/AriaCombobox";
import { useCoreFilter } from "../../combobox/root/utils/useFilter";
import { REASONS } from "../../internals/event-details";
import { stringifyAsLabel } from "../../select/utils/resolveValueLabel";

/**
 * Groups all parts of the autocomplete.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Rebase UI Autocomplete](https://rebase-ui.knst.dev/components/autocomplete)
 */
export function AutocompleteRoot<ItemValue>(props: AutocompleteRoot.Props<ItemValue>): JSX.Element {
  const other = omitProps(
    props,
    "openOnInputClick",
    "value",
    "defaultValue",
    "onValueChange",
    "mode",
    "itemToStringValue",
    "filter",
    "onItemHighlighted",
  );

  const mode = () => props.mode ?? "list";
  // Inline completion writes the highlighted label into the input, which `readOnly` must prevent.
  const enableInline = () => (mode() === "inline" || mode() === "both") && !props.readOnly;
  const isControlled = () => props.value !== undefined;

  // Mirror the typed value for uncontrolled usage so the temporary inline value can be composed.
  const local = createStore({ internalValue: (props.defaultValue ?? "") as string | number, inlineInputValue: "" });

  effect(() => {
    void props.value;
    if (isControlled() || !enableInline()) {
      // One-shot write: this effect only tracks the props above.
      untrack(() => {
        local.inlineInputValue = "";
      });
    }
  });

  // Recreated only when the locale changes: a new filter identity re-filters the list.
  let collator: ReturnType<typeof useCoreFilter> | undefined;
  let collatorLocale: Intl.LocalesArgument | undefined;
  function getCollator() {
    if (!collator || collatorLocale !== props.locale) {
      collatorLocale = props.locale;
      collator = useCoreFilter({ locale: collatorLocale });
    }
    return collator;
  }

  const query = () => String((isControlled() ? props.value : local.internalValue) ?? "").trim();

  function resolveFilter() {
    if (mode() === "inline" || mode() === "none" || props.filter === null) {
      return null;
    }
    return props.filter ?? getCollator().contains;
  }

  function resolveInputValue() {
    if (enableInline() && local.inlineInputValue !== "") {
      return local.inlineInputValue;
    }
    return isControlled() ? (props.value ?? "") : local.internalValue;
  }

  function handleValueChange(nextValue: string, eventDetails: AutocompleteRoot.ChangeEventDetails) {
    local.inlineInputValue = "";
    if (!isControlled()) {
      local.internalValue = nextValue;
    }
    props.onValueChange?.(nextValue, eventDetails);
  }

  function handleItemHighlighted(highlightedValue: ItemValue | undefined, eventDetails: AutocompleteRoot.HighlightEventDetails) {
    props.onItemHighlighted?.(highlightedValue, eventDetails);

    if (eventDetails.reason === REASONS.pointer) {
      return;
    }

    local.inlineInputValue = enableInline() && highlightedValue != null ? stringifyAsLabel(highlightedValue, props.itemToStringValue) : "";
  }

  return (
    <AriaCombobox
      {...(other as Record<string, unknown>)}
      itemToStringLabel={props.itemToStringValue as ((itemValue: unknown) => string) | undefined}
      openOnInputClick={props.openOnInputClick ?? false}
      selectionMode="none"
      fillInputOnItemPress
      filter={resolveFilter() as AriaCombobox.Props<unknown, "none">["filter"]}
      filterQuery={mode() === "both" ? query() : undefined}
      autoComplete={mode()}
      inputValue={resolveInputValue()}
      defaultInputValue={props.defaultValue as string | undefined}
      onInputValueChange={handleValueChange}
      onItemHighlighted={handleItemHighlighted as AriaCombobox.Props<unknown, "none">["onItemHighlighted"]}
    />
  );
}

export type AutocompleteRootState = AriaCombobox.State;
export type AutocompleteRootActions = AriaCombobox.Actions;
export type AutocompleteRootChangeEventReason = AriaCombobox.ChangeEventReason;
export type AutocompleteRootChangeEventDetails = AriaCombobox.ChangeEventDetails;
export type AutocompleteRootOpenChangeEventDetails = AriaCombobox.OpenChangeEventDetails;
export type AutocompleteRootHighlightEventReason = AriaCombobox.HighlightEventReason;
export type AutocompleteRootHighlightEventDetails = AriaCombobox.HighlightEventDetails;

export type AutocompleteRootProps<ItemValue> = Omit<
  AriaCombobox.Props<ItemValue, "none">,
  | "selectionMode"
  | "selectedValue"
  | "defaultSelectedValue"
  | "onSelectedValueChange"
  | "fillInputOnItemPress"
  | "itemToStringValue"
  | "isItemEqualToValue"
  | "filterQuery"
  // Different names
  | "inputValue"
  | "defaultInputValue"
  | "onInputValueChange"
  | "autoComplete"
  | "formAutoComplete"
  | "itemToStringLabel"
  | "autoHighlight"
> & {
  /**
   * Controls how the autocomplete behaves with respect to list filtering and inline autocompletion.
   * - `list` (default): items are dynamically filtered based on the input value. The input value does not change based on the active item.
   * - `both`: items are dynamically filtered based on the input value, which will temporarily change based on the active item (inline autocompletion).
   * - `inline`: items are static (not filtered), and the input value will temporarily change based on the active item (inline autocompletion).
   * - `none`: items are static (not filtered), and the input value will not change based on the active item.
   * @default 'list'
   */
  mode?: "list" | "both" | "inline" | "none" | undefined;
  /**
   * Whether the first matching item is highlighted automatically.
   * - `true`: highlight after the user types and keep the highlight while the query changes.
   * - `'always'`: always highlight the first item.
   * @default false
   */
  autoHighlight?: boolean | "always" | undefined;
  /**
   * The uncontrolled input value of the autocomplete when it's initially rendered.
   *
   * To render a controlled autocomplete, use the `value` prop instead.
   */
  defaultValue?: string | number | undefined;
  /**
   * The input value of the autocomplete. Use when controlled.
   */
  value?: string | number | undefined;
  /**
   * Event handler called when the input value of the autocomplete changes.
   */
  onValueChange?: ((value: string, eventDetails: AutocompleteRootChangeEventDetails) => void) | undefined;
  /**
   * When the item values are objects (`<Autocomplete.Item value={object}>`), this function converts the object value to a string representation for both display in the input and form submission.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   */
  itemToStringValue?: ((itemValue: ItemValue) => string) | undefined;
};

export namespace AutocompleteRoot {
  export type Props<ItemValue> = AutocompleteRootProps<ItemValue>;
  export type State = AutocompleteRootState;
  export type Actions = AutocompleteRootActions;
  export type ChangeEventReason = AutocompleteRootChangeEventReason;
  export type ChangeEventDetails = AutocompleteRootChangeEventDetails;
  export type OpenChangeEventDetails = AutocompleteRootOpenChangeEventDetails;
  export type HighlightEventReason = AutocompleteRootHighlightEventReason;
  export type HighlightEventDetails = AutocompleteRootHighlightEventDetails;
}
