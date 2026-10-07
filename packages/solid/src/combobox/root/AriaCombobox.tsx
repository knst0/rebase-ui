import type { JSX } from "@solidjs/web";
import { For, onSettled, untrack, type Setter } from "solid-js";

import { CompositeListContext, createCompositeList } from "../../internals/composite";
import { REASONS } from "../../internals/event-details";
import type { RebaseUIChangeEventDetails, RebaseUIGenericEventDetails } from "../../internals/event-details/createEventDetails";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { visuallyHidden, visuallyHiddenInput } from "../../internals/utils/visuallyHidden";
import { stringifyAsValue } from "../../select/utils/resolveValueLabel";
import type { Group } from "../../select/utils/resolveValueLabel";
import type { ComboboxItemCollection, ItemCollection } from "../items/itemCollection";
import {
  ComboboxDerivedItemsContext,
  ComboboxFloatingContext,
  ComboboxHasItemsContext,
  ComboboxInputValueContext,
  ComboboxRootContext,
} from "./ComboboxRootContext";
import { createComboboxRoot } from "./createComboboxRoot";

type InternalAriaComboboxProps<Value, Mode extends SelectionMode, Item = Value> = AriaComboboxProps<Value, Mode, Item> & {
  filterQuery?: string | undefined;
};

/**
 * @internal
 */
export function AriaCombobox<Value, Mode extends SelectionMode = "none", Item = Value>(
  props: Omit<InternalAriaComboboxProps<Value, Mode, Item>, "items"> & {
    items: readonly Group<any>[];
  },
): JSX.Element;
export function AriaCombobox<Value, Mode extends SelectionMode = "none", Item = Value>(
  props: Omit<InternalAriaComboboxProps<Value, Mode, Item>, "items"> & {
    items?: readonly any[] | ComboboxItemCollection<Item, any> | undefined;
  },
): JSX.Element;
export function AriaCombobox<Value = any, Mode extends SelectionMode = "none", Item = Value>(
  props: InternalAriaComboboxProps<Value, Mode, Item>,
): JSX.Element {
  const root = createComboboxRoot({
    id: () => props.id,
    selectionMode: () => props.selectionMode,
    selectedValue: () => props.selectedValue as any,
    defaultSelectedValue: () => props.defaultSelectedValue as any,
    onSelectedValueChange: (value, eventDetails) =>
      (props.onSelectedValueChange as ((value: any, eventDetails: AriaCombobox.ChangeEventDetails) => void) | undefined)?.(
        value,
        eventDetails,
      ),
    inputValue: () => props.inputValue as any,
    defaultInputValue: () => props.defaultInputValue as any,
    onInputValueChange: (value, eventDetails) => props.onInputValueChange?.(value, eventDetails),
    open: () => props.open,
    defaultOpen: () => props.defaultOpen ?? false,
    onOpenChange: (open, eventDetails) => props.onOpenChange?.(open, eventDetails),
    onOpenChangeComplete: (open) => props.onOpenChangeComplete?.(open),
    onItemHighlighted: props.onItemHighlighted as
      | ((value: any, eventDetails: AriaCombobox.HighlightEventDetails) => void)
      | undefined as CreateComboboxOnItemHighlighted,
    name: () => props.name,
    form: () => props.form,
    disabled: () => props.disabled ?? false,
    readOnly: () => props.readOnly ?? false,
    required: () => props.required ?? false,
    grid: () => props.grid ?? false,
    items: () => props.items as readonly any[] | readonly Group<any>[] | ItemCollection | undefined,
    filteredItems: () => props.filteredItems as readonly any[] | readonly Group<any>[] | undefined,
    filter: () => props.filter as ((item: any, query: string, itemToString?: (item: any) => string) => boolean) | null | undefined,
    filterQuery: () => props.filterQuery,
    itemToStringLabel: () => props.itemToStringLabel as ((itemValue: any) => string) | undefined,
    itemToStringValue: () => props.itemToStringValue as ((itemValue: any) => string) | undefined,
    isItemEqualToValue: () => props.isItemEqualToValue as ((itemValue: any, value: any) => boolean) | undefined,
    virtualized: () => props.virtualized ?? false,
    inline: () => props.inline ?? false,
    openOnInputClick: () => props.openOnInputClick ?? true,
    autoHighlight: () => props.autoHighlight ?? false,
    keepHighlight: () => props.keepHighlight ?? false,
    highlightItemOnHover: () => props.highlightItemOnHover ?? true,
    loopFocus: () => props.loopFocus ?? true,
    fillInputOnItemPress: () => props.fillInputOnItemPress ?? true,
    modal: () => props.modal ?? false,
    limit: () => props.limit ?? -1,
    autoComplete: () => props.autoComplete ?? "list",
    formAutoComplete: () => props.formAutoComplete,
    locale: () => props.locale,
    submitOnItemClick: () => props.submitOnItemClick ?? false,
    hasActionsRef: untrack(() => props.actionsRef) !== undefined,
  });
  // Item registration for the whole subtree (typeahead, highlight, selection
  // index). Provided here rather than in the list: a Solid provider only
  // delivers context to JSX evaluated inside it, so a list-level provider
  // would stay invisible to the items it wraps (upstream React re-renders
  // children under the provider, which has no Solid equivalent).
  const compositeList = createCompositeList<{ label?: string | null }>();
  const field = useFieldRootContext();

  const actionsRef = untrack(() => props.actionsRef);
  if (actionsRef) {
    // Delivering the actions is a signal write, so it happens outside the
    // component's owned scope once rendering has settled.
    onSettled(() => {
      actionsRef({ unmount: root.forceUnmount });

      return () => {
        actionsRef(null);
      };
    });
  }

  const mergedInputRef = mergeRefs(
    untrack(() => props.inputRef),
    (element: HTMLInputElement) => {
      field.validation.inputElement = element;
    },
  );

  const hiddenInputName = () => {
    const mode = root.store.select("selectionMode") as string;
    const ownsFormValue = root.store.select("inputOwnsFormValue") as boolean;
    return mode === "multiple" || (mode === "none" && ownsFormValue) ? undefined : root.name();
  };

  return (
    <ComboboxRootContext value={root.store}>
      <ComboboxFloatingContext value={untrack(() => root.store.peek("floatingRootContext"))}>
        <ComboboxHasItemsContext value={root.hasItems}>
          <ComboboxDerivedItemsContext value={root.derivedItems}>
            <ComboboxInputValueContext value={root.inputValueString}>
              <CompositeListContext value={compositeList.contextValue}>{untrack(() => props.children) as JSX.Element}</CompositeListContext>
              <RenderElement
                as="input"
                props={[
                  {
                    ref: mergedInputRef,
                    "aria-hidden": "true",
                    tabindex: -1,
                    onFocus: root.handleHiddenInputFocus,
                    onChange: root.handleAutofillChange,
                    get id() {
                      return root.generatedId() && hiddenInputName() == null ? `${root.generatedId()}-hidden-input` : undefined;
                    },
                    get form() {
                      return props.form;
                    },
                    get name() {
                      return hiddenInputName();
                    },
                    get autocomplete() {
                      return props.formAutoComplete;
                    },
                    get value() {
                      return root.serializedValue();
                    },
                    get disabled() {
                      return root.disabled();
                    },
                    get required() {
                      return (props.required ?? false) && !root.hasMultipleSelection();
                    },
                    get readonly() {
                      return props.readOnly;
                    },
                    get style() {
                      return hiddenInputName() ? visuallyHiddenInput : visuallyHidden;
                    },
                  },
                  (externalProps) => field.validation.getValidationProps(root.disabled(), externalProps),
                ]}
              />
              <For each={root.multipleValues()}>
                {(itemValue) => (
                  <input
                    type="hidden"
                    form={props.form}
                    name={root.name()}
                    value={stringifyAsValue(
                      itemValue,
                      untrack(() => props.itemToStringValue),
                    )}
                    disabled={root.disabled()}
                  />
                )}
              </For>
            </ComboboxInputValueContext>
          </ComboboxDerivedItemsContext>
        </ComboboxHasItemsContext>
      </ComboboxFloatingContext>
    </ComboboxRootContext>
  );
}

// Helper alias so the `onItemHighlighted` prop cast above stays readable.
type CreateComboboxOnItemHighlighted = ((value: any, eventDetails: AriaCombobox.HighlightEventDetails) => void) | undefined;

export type SelectionMode = "single" | "multiple" | "none";

export type ComboboxItemValueType<ItemValue, Mode extends SelectionMode> = Mode extends "multiple" ? ItemValue[] : ItemValue;

interface ComboboxRootProps<ItemValue, Item = ItemValue> {
  children?: JSX.Element;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the internal input.
   * Useful when the combobox is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The id of the component.
   */
  id?: string | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to choose a different option from the popup.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the popup is initially open.
   *
   * To render a controlled popup, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the popup is currently open. Use when controlled.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the popup is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: AriaCombobox.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the popup is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the popup opens when clicking the input.
   * @default true
   */
  openOnInputClick?: boolean | undefined;
  /**
   * Whether the first matching item is highlighted automatically.
   * - `false`: do not highlight automatically.
   * - `true`: highlight after the user types and keep the highlight while the query changes.
   * - `'always'`: highlight the first item as soon as the list opens.
   * @default false
   */
  autoHighlight?: boolean | "always" | undefined;
  /**
   * Whether the highlighted item should be preserved when the pointer leaves the list.
   * @default false
   */
  keepHighlight?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the input when the end of the list is reached while using the arrow keys. The first item can then be reached by pressing <kbd>ArrowDown</kbd> again from the input, or the last item can be reached by pressing <kbd>ArrowUp</kbd> from the input.
   * The input is always included in the focus loop per [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
   * When disabled, focus does not move when on the last element and the user presses <kbd>ArrowDown</kbd>, or when on the first element and the user presses <kbd>ArrowUp</kbd>.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * The input value of the combobox. Use when controlled.
   */
  inputValue?: string | number | undefined;
  /**
   * Callback fired when the input value of the combobox changes.
   */
  onInputValueChange?: ((value: string, eventDetails: AriaCombobox.ChangeEventDetails) => void) | undefined;
  /**
   * The uncontrolled input value when initially rendered.
   *
   * To render a controlled input, use the `inputValue` prop instead.
   */
  defaultInputValue?: string | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Manually unmounts the combobox.
   * Call this after any externally controlled closing animation finishes.
   */
  actionsRef?: Setter<AriaCombobox.Actions | null> | undefined;
  /**
   * Callback fired when an item is highlighted or unhighlighted.
   * Receives the highlighted item value (or `undefined` if no item is highlighted) and event details with a `reason` property describing why the highlight changed.
   * The `reason` can be:
   * - `'keyboard'`: the highlight changed due to keyboard navigation.
   * - `'pointer'`: the highlight changed due to pointer hovering.
   * - `'none'`: the highlight changed programmatically.
   */
  onItemHighlighted?: ((itemValue: ItemValue | undefined, eventDetails: AriaCombobox.HighlightEventDetails) => void) | undefined;
  /**
   * A ref to the hidden input element.
   */
  inputRef?: ((element: HTMLInputElement) => void) | undefined;
  /**
   * Whether list items are presented in a grid layout.
   * When enabled, arrow keys navigate across rows and columns inferred from DOM rows.
   * @default false
   */
  grid?: boolean | undefined;
  /**
   * The items to be displayed in the list.
   * Can be a flat array of items, an array of groups with items, or a collection created by
   * the `createItems()` function, which derives each item's selection value and label.
   * Nullish entries are not supported: remove them from the data before passing it.
   */
  items?: readonly any[] | readonly Group<any>[] | ComboboxItemCollection<Item, ItemValue> | undefined;
  /**
   * Filtered items to display in the list.
   * When provided, the list uses these items instead of filtering the `items` prop internally.
   * When `items` is also provided, this array must preserve its flat or grouped structure.
   * With a `createItems()` collection, pass source items rather than derived values.
   * Nullish entries are not supported, as in `items`.
   * Use when you want to control filtering logic externally with the `useFilter()` hook.
   */
  filteredItems?: readonly Item[] | readonly Group<Item>[] | undefined;
  /**
   * Filter function used to match items vs input query.
   * Receives the source item, which is the derived value's item when `items` is a `createItems()`
   * collection, and the item itself otherwise.
   */
  filter?: null | ((item: Item, query: string, itemToString?: (item: Item) => string) => boolean) | undefined;
  /**
   * When the item values are objects (`<Combobox.Item value={object}>`), this function converts the object value to a string representation for display in the input.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   * With a `createItems()` collection, this receives the derived value, and the collection's
   * `getLabel` takes precedence for values it can resolve.
   */
  itemToStringLabel?: ((itemValue: ItemValue) => string) | undefined;
  /**
   * When the item values are objects (`<Combobox.Item value={object}>`), this function converts the object value to a string representation for form submission.
   * If the shape of the object is `{ value, label }`, the value will be used automatically without needing to specify this prop.
   * With a `createItems()` collection, this receives the derived value.
   */
  itemToStringValue?: ((itemValue: ItemValue) => string) | undefined;
  /**
   * Custom comparison logic used to determine if a combobox item value matches the current selected value. Useful when item values are objects without matching referentially.
   * With a `createItems()` collection, both arguments are derived values.
   * Defaults to `Object.is` comparison.
   */
  isItemEqualToValue?: ((itemValue: ItemValue, value: ItemValue) => boolean) | undefined;
  /**
   * Whether the items are being externally virtualized.
   * @default false
   */
  virtualized?: boolean | undefined;
  /**
   * Whether the list is rendered inline without using the component's own popup.
   *
   * Specify `open` unconditionally in conjunction with this prop so the list is considered
   * visible: `<Combobox.Root inline open>`
   *
   * In a `Combobox.Root` > `Dialog.Root` composition, bind the Combobox's `open` and
   * `onOpenChange` props to the `Dialog`'s `open` and `onOpenChange` state instead so the
   * component resets its transient state (filter query, highlighted item, and input value) when
   * the dialog closes.
   * @default false
   */
  inline?: boolean | undefined;
  /**
   * Determines if the popup enters a modal state when open.
   * - `true`: user interaction is limited to the popup: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   * @default false
   */
  modal?: boolean | undefined;
  /**
   * The maximum number of items to display in the list.
   * @default -1
   */
  limit?: number | undefined;
  /**
   * Controls how the component behaves with respect to list filtering and inline autocompletion.
   * - `list` (default): items are dynamically filtered based on the input value. The input value does not change based on the active item.
   * - `both`: items are dynamically filtered based on the input value, which will temporarily change based on the active item (inline autocompletion).
   * - `inline`: items are static (not filtered), and the input value will temporarily change based on the active item (inline autocompletion).
   * - `none`: items are static (not filtered), and the input value will not change based on the active item.
   * @default 'list'
   */
  autoComplete?: "list" | "both" | "inline" | "none" | undefined;
  /**
   * Provides a hint to the browser for autofill on the hidden input element.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  formAutoComplete?: string | undefined;
  /**
   * The locale to use for string comparison.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * Whether clicking an item should submit the owning form.
   * @default false
   */
  submitOnItemClick?: boolean | undefined;
  /**
   * INTERNAL: When `selectionMode` is `none`, controls whether selecting an item fills the input.
   */
  fillInputOnItemPress?: boolean | undefined;
}

export interface AriaComboboxState {}

export type AriaComboboxProps<Value, Mode extends SelectionMode = "none", Item = Value> = ComboboxRootProps<Value, Item> & {
  /**
   * How the combobox should remember the selected value.
   * - `single`: Remembers the last selected value.
   * - `multiple`: Remember all selected values.
   */
  selectionMode: Mode;
  /**
   * The selected value of the combobox. Use when controlled.
   */
  selectedValue?: ComboboxItemValueType<Value, Mode> | undefined;
  /**
   * The uncontrolled selected value of the combobox when it's initially rendered.
   *
   * To render a controlled combobox, use the `selectedValue` prop instead.
   */
  defaultSelectedValue?: ComboboxItemValueType<Value, Mode> | null | undefined;
  /**
   * Callback fired when the selected value of the combobox changes.
   */
  onSelectedValueChange?: ((value: ComboboxItemValueType<Value, Mode>, eventDetails: AriaCombobox.ChangeEventDetails) => void) | undefined;
};

export namespace AriaCombobox {
  export type Props<Value, Mode extends SelectionMode = "none", Item = Value> = AriaComboboxProps<Value, Mode, Item>;
  export type State = AriaComboboxState;

  export interface Actions {
    unmount: () => void;
  }

  export type HighlightEventReason = typeof REASONS.keyboard | typeof REASONS.pointer | typeof REASONS.none;
  export type HighlightEventDetails = RebaseUIGenericEventDetails<HighlightEventReason, { index: number }>;

  export type ChangeEventReason =
    | typeof REASONS.triggerPress
    | typeof REASONS.inputPress
    | typeof REASONS.outsidePress
    | typeof REASONS.itemPress
    | typeof REASONS.closePress
    | typeof REASONS.escapeKey
    | typeof REASONS.listNavigation
    | typeof REASONS.focusOut
    | typeof REASONS.inputChange
    | typeof REASONS.inputClear
    | typeof REASONS.clearPress
    | typeof REASONS.chipRemovePress
    | typeof REASONS.cancelOpen
    | typeof REASONS.none;
  export type ChangeEventDetails = RebaseUIChangeEventDetails<ChangeEventReason> & {
    /**
     * When `reason` is `input-clear` in multiple mode, indicates whether an item press caused the
     * clear. Automatic cleanup clears omit this property.
     */
    isItemPress?: boolean | undefined;
  };
}
