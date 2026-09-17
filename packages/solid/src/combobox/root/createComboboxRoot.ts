import { getOverflowAncestors } from "@floating-ui/utils/dom";
import { createEffect, createMemo, createSignal, untrack, type Accessor } from "solid-js";

import { EMPTY_ARRAY, EMPTY_OBJECT, NOOP } from "#utils/empty";

import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, createGenericEventDetails, REASONS } from "../../internals/event-details";
import { createRegisterFieldControl } from "../../internals/field-register-control/createRegisterFieldControl";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import { createClick } from "../../internals/floating/interactions/createClick";
import { createDismiss } from "../../internals/floating/interactions/createDismiss";
import { createListNavigation } from "../../internals/floating/interactions/createListNavigation";
import { gridNavigation } from "../../internals/floating/interactions/gridNavigation";
import { useFloatingRootContext } from "../../internals/floating/useFloatingRootContext";
import { contains, getTarget } from "../../internals/floating/utils/element";
import { useFormContext } from "../../internals/form-context/FormContext";
import { createLabelableId } from "../../internals/labelable-provider/createLabelableId";
import { FOCUSABLE_POPUP_PROPS, getRootFloatingContext } from "../../internals/popups/popupStoreUtils";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { stableCallback } from "../../internals/stableCallback";
import { createTransitionStatus } from "../../internals/transition-status/createTransitionStatus";
import { error } from "../../internals/utils/error";
import {
  compareItemEquality,
  defaultItemEquality,
  findItemIndex,
  findSelectionIndex,
  isSelectedValueDirty,
  removeItem,
  selectedValueIncludes,
} from "../../select/utils/itemEquality";
import { flattenLeafItems, isGroupedItems, stringifyAsLabel, stringifyAsValue, type Group } from "../../select/utils/resolveValueLabel";
import type { ItemCollection } from "../items/itemCollection";
import { findCollectionItem } from "../items/itemCollection";
import {
  createInitialComboboxStoreContext,
  createInitialComboboxStoreState,
  ComboboxStore,
  type ComboboxInteractionType,
  type ComboboxStoreState,
} from "../store/ComboboxStore";
import type { AriaCombobox } from "./AriaCombobox";
import type { ComboboxDerivedItemsContextValue } from "./ComboboxRootContext";
import { createCollatorItemFilter, type FilterItemToString } from "./utils";
import { INITIAL_LAST_HIGHLIGHT, NO_ACTIVE_VALUE } from "./utils/constants";
import { useCoreFilter } from "./utils/useFilter";

export interface CreateComboboxRootParameters {
  id: () => string | undefined;
  selectionMode: () => "single" | "multiple" | "none";
  selectedValue: () => any;
  defaultSelectedValue: () => any;
  onSelectedValueChange: (value: any, eventDetails: AriaCombobox.ChangeEventDetails) => void;
  inputValue: () => any;
  defaultInputValue: () => any;
  onInputValueChange: (value: string, eventDetails: AriaCombobox.ChangeEventDetails) => void;
  open: () => boolean | undefined;
  defaultOpen: () => boolean;
  onOpenChange: (open: boolean, eventDetails: AriaCombobox.ChangeEventDetails) => void;
  onOpenChangeComplete: (open: boolean) => void;
  onItemHighlighted: ((value: any, eventDetails: AriaCombobox.HighlightEventDetails) => void) | undefined;
  name: () => string | undefined;
  form: () => string | undefined;
  disabled: () => boolean;
  readOnly: () => boolean;
  required: () => boolean;
  grid: () => boolean;
  items: () => readonly any[] | readonly Group<any>[] | ItemCollection | undefined;
  filteredItems: () => readonly any[] | readonly Group<any>[] | undefined;
  filter: () => ((item: any, query: string, itemToString?: (item: any) => string) => boolean) | null | undefined;
  filterQuery: () => string | undefined;
  itemToStringLabel: () => ((itemValue: any) => string) | undefined;
  itemToStringValue: () => ((itemValue: any) => string) | undefined;
  isItemEqualToValue: () => ((itemValue: any, value: any) => boolean) | undefined;
  virtualized: () => boolean;
  inline: () => boolean;
  openOnInputClick: () => boolean;
  autoHighlight: () => boolean | "always" | undefined;
  keepHighlight: () => boolean;
  highlightItemOnHover: () => boolean;
  loopFocus: () => boolean;
  fillInputOnItemPress: () => boolean;
  modal: () => boolean;
  limit: () => number;
  autoComplete: () => "list" | "both" | "inline" | "none";
  formAutoComplete: () => string | undefined;
  locale: () => Intl.LocalesArgument | undefined;
  submitOnItemClick: () => boolean;
  hasActionsRef: boolean;
}

export interface CreateComboboxRootReturnValue {
  store: ComboboxStore;
  open: () => boolean;
  inputValue: Accessor<any>;
  inputValueString: () => string;
  selectedValue: () => any;
  mounted: () => boolean;
  generatedId: () => string;
  disabled: () => boolean;
  name: () => string | undefined;
  itemProps: Record<string, unknown>;
  serializedValue: () => string;
  hasMultipleSelection: () => boolean;
  multipleValues: () => any[];
  derivedItems: ComboboxDerivedItemsContextValue;
  hasItems: () => boolean;
  forceUnmount: () => void;
  handleHiddenInputFocus: () => void;
  handleAutofillChange: (event: Event) => void;
}

function isScrollableY(element: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(element);
  return (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight;
}

/**
 * Runs `handler` untracked whenever the value returned by `get` changes.
 * Mirrors upstream `useValueChanged`.
 */
function trackValueChange(get: () => unknown, handler: () => void): void {
  let previous = untrack(get);
  createEffect(
    () => get(),
    (current) => {
      if (!Object.is(previous, current)) {
        previous = current;
        untrack(handler);
      }
      return undefined;
    },
  );
}

export function createComboboxRoot(parameters: CreateComboboxRootParameters): CreateComboboxRootReturnValue {
  const field = useFieldRootContext();
  const form = useFormContext();

  const generatedId = createLabelableId({ id: () => parameters.id() });

  const disabled = () => (field.disabled() ?? false) || parameters.disabled();
  const name = () => field.name() ?? parameters.name();

  const selectionMode = () => parameters.selectionMode();
  const multiple = () => selectionMode() === "multiple";
  const single = () => selectionMode() === "single";

  const comparer = () => parameters.isItemEqualToValue() ?? defaultItemEquality;

  const hasInputValueProp = untrack(() => parameters.inputValue() !== undefined || parameters.defaultInputValue() !== undefined);

  const [selectedValue, setSelectedValueUnwrapped] = createControllableSignal({
    value: () => parameters.selectedValue(),
    defaultValue: () => {
      const fallback = parameters.defaultSelectedValue();
      return multiple() ? (fallback ?? EMPTY_ARRAY) : fallback;
    },
  });

  const autoHighlightMode = (): false | "input-change" | "always" => {
    const autoHighlight = parameters.autoHighlight();
    if (autoHighlight === "always") {
      return "always";
    }
    return autoHighlight ? "input-change" : false;
  };

  const collatorFilter = createMemo(() => useCoreFilter({ locale: parameters.locale() }));

  // Plain items are arrays; normalized `createItems()` collections are objects.
  const collection = createMemo(() => {
    const itemsProp = parameters.items();
    if (Array.isArray(itemsProp)) {
      return null;
    }
    return itemsProp as unknown as ItemCollection | undefined;
  });

  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    const initialCollection = untrack(collection);
    if (initialCollection && typeof (initialCollection as ItemCollection).label !== "function") {
      error(
        "the `items` prop received an object that is not a collection, " +
          "so its items cannot be read. Pass an array of items, an array of groups with items, " +
          "or the result of `createItems()`.",
      );
    }
  }

  const items = createMemo(() => {
    const activeCollection = collection();
    const itemsProp = parameters.items();
    return (activeCollection ? activeCollection.data : itemsProp) as readonly any[] | readonly Group<any>[] | undefined;
  });
  const itemToValue = createMemo(() => collection()?.value);
  const hasItems = () => items() !== undefined;

  // A projected collection's items live in the source domain, not the selection-value domain the
  // store matches against, so they are withheld from the store.
  const storeItems = createMemo(() => (itemToValue() ? undefined : items()) as readonly any[] | undefined);

  // The externally filtered items projected to their selection values, with a lookup back to the
  // source items.
  const externalWindow = createMemo(() => {
    const filteredItemsProp = parameters.filteredItems();
    const project = itemToValue();
    if (!filteredItemsProp || !project) {
      return undefined;
    }
    const flat = flattenLeafItems(filteredItemsProp);
    const values = flat.map(project);
    let valueToItem: Map<any, any> | undefined;
    return {
      values,
      findItem(itemValue: any, isEqual: (item: any, value: any) => boolean) {
        if (!valueToItem) {
          valueToItem = new Map();
          for (let index = 0; index < values.length; index += 1) {
            if (!valueToItem.has(values[index])) {
              valueToItem.set(values[index], flat[index]);
            }
          }
        }
        return findCollectionItem(valueToItem, itemValue, isEqual);
      },
    };
  });

  const itemToStringLabel = createMemo(() => {
    const activeCollection = collection();
    if (!activeCollection) {
      return parameters.itemToStringLabel();
    }
    const resolve: ((itemValue: any) => string) & { selected?: (value: any) => string } = (itemValue: any) =>
      activeCollection.label(itemValue, comparer(), (unresolvedValue: any) => {
        const externalItem = externalWindow()?.findItem(unresolvedValue, comparer());
        if (externalItem != null) {
          return activeCollection.itemLabel(externalItem);
        }
        return stringifyAsLabel(unresolvedValue, parameters.itemToStringLabel());
      });
    return resolve;
  });

  const filterItemToString = createMemo<FilterItemToString | undefined>(() => {
    const activeCollection = collection();
    if (!activeCollection) {
      return parameters.itemToStringLabel();
    }
    const resolveLabel = itemToStringLabel();
    return Object.assign((item: any) => activeCollection.itemLabel(item), {
      selected: (value: any) => stringifyAsLabel(value, resolveLabel),
    });
  });

  function stringifyValueLabel(item: any) {
    return stringifyAsLabel(item, itemToStringLabel());
  }

  const [queryChangedAfterOpen, setQueryChangedAfterOpen] = createSignal(false);
  const [closeQuery, setCloseQuery] = createSignal<string | null>(null);
  let previousCloseQuery: string | null = untrack(closeQuery);

  const [inputValue, setInputValueUnwrapped] = createControllableSignal({
    value: () => parameters.inputValue(),
    defaultValue: () =>
      untrack(() => {
        if (hasInputValueProp) {
          return (parameters.defaultInputValue() ?? "") as string;
        }
        if (single()) {
          return stringifyValueLabel(selectedValue());
        }
        return "";
      }),
  });

  const [openProp, setOpenUnwrapped] = createControllableSignal({
    value: () => parameters.open(),
    defaultValue: () => parameters.defaultOpen(),
  });
  const open = () => openProp() ?? false;

  const isGrouped = createMemo(() => isGroupedItems(items()));
  const query = () => (!open() && closeQuery() !== null ? (closeQuery() as string) : String(inputValue()).trim());

  const selectedLabelString = createMemo(() => (single() ? stringifyValueLabel(selectedValue()) : ""));

  const shouldBypassFiltering = () =>
    single() &&
    !queryChangedAfterOpen() &&
    query() !== "" &&
    selectedLabelString().length === query().length &&
    collatorFilter().contains(selectedLabelString(), query());

  const filterQuery = () => (shouldBypassFiltering() ? "" : (parameters.filterQuery() ?? query()));
  const shouldIgnoreExternalFiltering = () =>
    hasItems() &&
    parameters.filteredItems() !== undefined &&
    shouldBypassFiltering() &&
    (!collection() || collection()!.hasValue(selectedValue(), comparer()));

  const flatItems = createMemo(() => (items() ? flattenLeafItems<any>(items()!) : (EMPTY_ARRAY as readonly any[])));

  const filter = createMemo(() => {
    const filterProp = parameters.filter();
    if (filterProp === null) {
      return () => true;
    }
    if (filterProp !== undefined) {
      return filterProp;
    }
    // `shouldBypassFiltering` already empties the query whenever a single selection's label
    // matches it exactly, so the filter never needs a selection-aware variant here.
    return createCollatorItemFilter(collatorFilter(), filterItemToString());
  });

  const filteredItems = createMemo(() => {
    const filteredItemsProp = parameters.filteredItems();
    if (filteredItemsProp && !shouldIgnoreExternalFiltering()) {
      return filteredItemsProp as any[] | Group<any>[];
    }
    const sourceItems = items();
    if (!sourceItems) {
      return EMPTY_ARRAY as unknown as any[];
    }
    const activeFilter = filter();
    const activeFilterQuery = filterQuery();
    const activeLimit = parameters.limit();
    const stringify = filterItemToString();
    if (isGrouped()) {
      const resultingGroups: Group<any>[] = [];
      let currentCount = 0;
      for (const group of sourceItems as readonly Group<any>[]) {
        if (activeLimit > -1 && currentCount >= activeLimit) {
          break;
        }
        const remainingLimit = activeLimit > -1 ? activeLimit - currentCount : Infinity;
        const itemsToTake: any[] = activeFilterQuery === "" ? group.items.slice(0, remainingLimit) : [];
        if (activeFilterQuery !== "") {
          for (const item of group.items) {
            if (itemsToTake.length >= remainingLimit) {
              break;
            }
            if (activeFilter(item, activeFilterQuery, stringify)) {
              itemsToTake.push(item);
            }
          }
        }
        if (itemsToTake.length > 0) {
          resultingGroups.push({ ...group, items: itemsToTake });
          currentCount += itemsToTake.length;
        }
      }
      return resultingGroups;
    }
    const flat = flatItems();
    if (activeFilterQuery === "") {
      return activeLimit > -1 ? flat.slice(0, activeLimit) : (flat as any[]);
    }
    const limitedItems: any[] = [];
    for (const item of flat) {
      if (activeLimit > -1 && limitedItems.length >= activeLimit) {
        break;
      }
      if (activeFilter(item, activeFilterQuery, stringify)) {
        limitedItems.push(item);
      }
    }
    return limitedItems;
  });

  /**
   * The filtered items flattened across groups and projected to their selection values.
   */
  const flatFilteredValues = createMemo((): any[] => {
    const window = externalWindow();
    const filtered = filteredItems();
    if (window && filtered === parameters.filteredItems()) {
      return window.values;
    }
    const flat = flattenLeafItems<any>(filtered as any[] | Group<any>[]);
    const project = itemToValue();
    return project ? flat.map((item) => project(item)) : (flat as any[]);
  });

  const onSelectedValueChange = stableCallback(() => parameters.onSelectedValueChange);
  const onInputValueChangeProp = stableCallback(() => parameters.onInputValueChange);
  const onOpenChange = stableCallback(() => parameters.onOpenChange);
  const onOpenChangeComplete = stableCallback(() => parameters.onOpenChangeComplete);
  const onItemHighlighted = stableCallback(() => parameters.onItemHighlighted);

  // `useFloatingRootContext` reads the initial open state eagerly while the store is created;
  // untrack the setup read (the open value stays reactive through the synced effect inside).
  const floatingRootContext = untrack(() =>
    useFloatingRootContext({
      open: () => (parameters.inline() ? true : open()),
      onOpenChange: (nextOpen, eventDetails) => setOpen(nextOpen, eventDetails as AriaCombobox.ChangeEventDetails),
    }),
  );

  // One-time setup reads: the store constructor takes a snapshot, so evaluate the initial
  // values untracked (they stay reactive through the synced values below).
  const initialState = untrack(() => {
    // An inline list open on the first render never gets a closed pass of the closed-state
    // sync effect below, and `items`-prop lists don't self-register their index the way
    // individually rendered `<Combobox.Item>`s do, so the selected item was never highlighted.
    // Seeding the index here lets list navigation highlight and scroll to the selection on
    // mount. Computed once by construction, so a selection or list that resolves after mount
    // doesn't move an existing highlight or scroll the list away.
    let initialSelectedIndex: number | null = null;
    if (parameters.inline() && open() && hasItems() && selectionMode() !== "none") {
      initialSelectedIndex = findSelectionIndex(flatFilteredValues(), selectedValue(), comparer(), multiple());
    }
    return {
      floatingRootContext,
      id: generatedId(),
      labelId: undefined as string | undefined,
      selectedValue: selectedValue(),
      open: open(),
      items: storeItems(),
      selectionMode: selectionMode(),
      name: name(),
      form: parameters.form(),
      disabled: disabled(),
      readOnly: parameters.readOnly(),
      required: parameters.required(),
      grid: parameters.grid(),
      virtualized: parameters.virtualized(),
      openOnInputClick: parameters.openOnInputClick(),
      itemToStringLabel: itemToStringLabel(),
      isItemEqualToValue: comparer(),
      modal: parameters.modal(),
      autoHighlight: autoHighlightMode(),
      submitOnItemClick: parameters.submitOnItemClick(),
      hasInputValue: hasInputValueProp,
      inline: parameters.inline(),
      activeIndex: null as number | null,
      selectedIndex: initialSelectedIndex,
    };
  });

  const store = new ComboboxStore(createInitialComboboxStoreState(initialState), {
    ...createInitialComboboxStoreContext(),
    setOpen: NOOP as ComboboxStore["context"]["setOpen"],
    setInputValue: NOOP as ComboboxStore["context"]["setInputValue"],
    setSelectedValue: NOOP as ComboboxStore["context"]["setSelectedValue"],
    setIndices: NOOP as ComboboxStore["context"]["setIndices"],
    forceMount: NOOP as ComboboxStore["context"]["forceMount"],
    handleSelection: NOOP as ComboboxStore["context"]["handleSelection"],
    requestSubmit: NOOP as ComboboxStore["context"]["requestSubmit"],
    onOpenChangeComplete: NOOP as ComboboxStore["context"]["onOpenChangeComplete"],
  });

  const fieldRawValue = () => (selectionMode() === "none" ? inputValue() : selectedValue());
  const fieldStringValue = createMemo(() => {
    const rawValue = fieldRawValue();
    if (selectionMode() === "none") {
      return rawValue;
    }
    if (Array.isArray(selectedValue())) {
      return selectedValue().map((value: any) => stringifyAsValue(value, parameters.itemToStringValue()));
    }
    return stringifyAsValue(selectedValue(), parameters.itemToStringValue());
  });

  const activeIndex = () => store.select("activeIndex") as number | null;
  // One-shot reads for event handlers and other untracked scopes. The two tracked
  // computations that need reactivity (the highlight effect and the role reference
  // props) read these keys through `store.select` directly.
  const inline = () => store.peek("inline") as boolean;
  const inputInsidePopup = () => store.peek("inputInsidePopup") as boolean;
  const inputMatchesSelectedValue = () => single() && !inputInsidePopup() && inputValue() === selectedLabelString();

  const { mounted, setMounted, transitionStatus } = createTransitionStatus(open);
  const [openMethod, setOpenMethod] = createSignal<ComboboxInteractionType | null>(null);

  // Mirrors upstream's `openMethod ?? previousOpenMethod`: the recorded interaction type stays
  // readable through the closing transition, and the store keeps it until `handleUnmount`
  // clears the state.
  let previousOpenMethod: ComboboxInteractionType | null = null;
  const renderedOpenMethod = createMemo(() => {
    const current = openMethod();
    const rendered = current ?? previousOpenMethod;
    previousOpenMethod = current;
    return rendered;
  });

  const getStringifiedValueForForm = () => fieldStringValue();

  createRegisterFieldControl({
    controlElement: () => (inputInsidePopup() ? store.peek("triggerElement") : store.peek("inputElement")) as HTMLElement | null,
    id: generatedId,
    value: fieldRawValue,
    getFormValue: getStringifiedValueForForm,
    enabled: () => !disabled(),
    name: () => parameters.name(),
  });

  let lastHighlight: { value: any; index: number } = INITIAL_LAST_HIGHLIGHT;
  let pendingQueryHighlight: null | {
    hasQuery: boolean;
    selection?: boolean | undefined;
    toggledValue?: any;
  } = null;
  let hadInputClear = false;

  /**
   * Emits `onItemHighlighted` for the item at `index`, or clears the highlight when `index` is `-1`
   * (a no-op if nothing was highlighted). Keeps the last-highlight record in sync with what was emitted.
   */
  function emitHighlight(value: any, index: number, type: AriaCombobox.HighlightEventReason) {
    if (index === -1) {
      if (lastHighlight === INITIAL_LAST_HIGHLIGHT) {
        return;
      }
      lastHighlight = INITIAL_LAST_HIGHLIGHT;
    } else {
      lastHighlight = { value, index };
    }
    // One-shot callback read: the effect apply scopes that reach this emitter
    // must not subscribe to the handler identity, so read it untracked.
    untrack(() => onItemHighlighted(value, createGenericEventDetails(type, undefined, { index })));
  }

  function setIndices(options: {
    activeIndex?: number | null | undefined;
    selectedIndex?: number | null | undefined;
    type?: AriaCombobox.HighlightEventReason | undefined;
  }) {
    const update = {} as Pick<ComboboxStoreState, "activeIndex" | "selectedIndex">;
    if (options.activeIndex !== undefined) {
      update.activeIndex = options.activeIndex;
    }
    if (options.selectedIndex !== undefined) {
      update.selectedIndex = options.selectedIndex;
    }
    store.update(update);
    const activeIndexOption = options.activeIndex;
    if (activeIndexOption === undefined) {
      return;
    }
    const type: AriaCombobox.HighlightEventReason = options.type || REASONS.none;
    if (activeIndexOption === null) {
      emitHighlight(undefined, -1, type);
    } else {
      emitHighlight(store.context.valuesRef.current[activeIndexOption], activeIndexOption, type);
    }
  }

  function setInputValue(next: string, eventDetails: AriaCombobox.ChangeEventDetails) {
    onInputValueChangeProp(next, eventDetails);
    if (eventDetails.isCanceled) {
      return;
    }
    // A canceled selection clear must not suppress close-completion cleanup.
    hadInputClear = eventDetails.reason === REASONS.inputClear;
    if (eventDetails.reason === REASONS.inputChange) {
      // A controlled popup may ignore a close request. Resuming input proves the popup
      // is remaining open, so release the query captured for an exit animation.
      if (open() && closeQuery() !== null) {
        setCloseQuery(null);
      }
      const event = eventDetails.event as Event;
      const inputType = (event as InputEvent).inputType;
      // Treat composition commits as typed input; autofill may omit `inputType` or
      // report `insertReplacementText`.
      const isTypedInput =
        event.type === "compositionend" || (inputType != null && inputType !== "" && inputType !== "insertReplacementText");
      if (isTypedInput) {
        const hasQuery = next.trim() !== "";
        if (hasQuery) {
          setQueryChangedAfterOpen(true);
        }
        // Defer index updates until after the filtered items have been derived to ensure
        // `onItemHighlighted` receives the latest item.
        pendingQueryHighlight = { hasQuery };
        // Virtualized lists own their scroller. Reset regular lists directly so a stale
        // composite registry cannot select a reordered item and scrolling cannot escape
        // the popup.
        const list = store.peekState().listElement;
        if (!store.peekState().virtualized && list) {
          const popup = store.context.popupRef.current;
          for (const ancestor of getOverflowAncestors(list.firstElementChild ?? list)) {
            if (!(ancestor instanceof HTMLElement) || (popup ? !contains(popup, ancestor) : ancestor.getAttribute("role") === "dialog")) {
              break;
            }
            if (isScrollableY(ancestor)) {
              ancestor.scrollTop = 0;
              break;
            }
          }
        }
        if (hasQuery && autoHighlightMode() && store.peekState().activeIndex == null && (open() || inline())) {
          store.set("activeIndex", 0);
        }
      }
    } else if (eventDetails.reason === REASONS.inputClear && next === "" && store.peekState().inputInsidePopup) {
      // A programmatic clear of an active query (e.g. after selecting an item with the
      // input inside the popup): restore the highlight to the selected item.
      pendingQueryHighlight = { hasQuery: false, selection: true };
    }
    setInputValueUnwrapped(next);
  }

  function handleInterruptedReopen(isInputChange: boolean) {
    // Preserve values supplied with the reopen rather than owned by the interrupted close.
    const clearsPendingInput =
      !isInputChange &&
      inputInsidePopup() &&
      !inline() &&
      inputValue() !== "" &&
      (String(inputValue()).trim() === closeQuery() || inputValue() === selectedLabelString());
    // Keep the flag while a visible filter survives so the `items` sync cannot overwrite it.
    if (!isInputChange && (clearsPendingInput || inputValue() === "" || inputMatchesSelectedValue())) {
      setQueryChangedAfterOpen(false);
    }
    setCloseQuery(null);
    if (clearsPendingInput) {
      // Cleanup clears omit the selection flag and reopening gesture.
      setInputValue("", createChangeEventDetails(REASONS.inputClear));
    }
  }

  function setOpen(nextOpen: boolean, eventDetails: AriaCombobox.ChangeEventDetails) {
    if (open() === nextOpen) {
      return;
    }
    // If the `Empty` component is not used, the positioner or popup should be hidden
    // with CSS. In this case, allow the Escape key to bubble to close a parent popup
    // if there are no items to show.
    if (eventDetails.reason === REASONS.escapeKey && hasItems() && flatFilteredValues().length === 0 && !store.context.emptyRef.current) {
      eventDetails.allowPropagation();
    }
    onOpenChange(nextOpen, eventDetails);
    if (eventDetails.isCanceled) {
      return;
    }
    if (nextOpen && closeQuery() !== null) {
      // `ComboboxInput` calls `setInputValue` before `setOpen`, so on an input-change reopen
      // `inputValue` is still the pre-keystroke value and the typed filter always survives.
      handleInterruptedReopen(eventDetails.reason === REASONS.inputChange);
    }
    if (!nextOpen && queryChangedAfterOpen()) {
      if (single()) {
        if (!inline()) {
          setCloseQuery(query());
        }
        // Avoid a flicker when closing the popup with an empty query.
        if (query() === "") {
          setQueryChangedAfterOpen(false);
        }
      } else if (multiple()) {
        if (!inline()) {
          // Freeze the current query so filtering remains stable while exiting.
          setCloseQuery(query());
        }
        if (inputInsidePopup()) {
          setIndices({ activeIndex: null });
        }
        // Clear the input immediately on close while retaining filtering via closeQuery for exit animations
        // if the input is outside the popup. When the input is inside the popup, defer the clear until
        // unmount so the filtered list doesn't flash to unfiltered during the exit animation.
        if (!inputInsidePopup() || inline()) {
          setInputValue(
            "",
            createChangeEventDetails(REASONS.inputClear, eventDetails.event, undefined, {
              isItemPress: eventDetails.reason === REASONS.itemPress,
            }),
          );
        }
      }
    }
    setOpenUnwrapped(nextOpen);
    if (!nextOpen && inputInsidePopup() && (eventDetails.reason === REASONS.focusOut || eventDetails.reason === REASONS.outsidePress)) {
      field.setTouched(true);
      field.setFocused(false);
      if (field.validationMode === "onBlur") {
        const valueToValidate = selectionMode() === "none" ? inputValue() : selectedValue();
        void field.validation.commit(valueToValidate);
      }
    }
  }

  function setSelectedValue(nextValue: any, eventDetails: AriaCombobox.ChangeEventDetails) {
    onSelectedValueChange(nextValue, eventDetails);
    if (eventDetails.isCanceled) {
      return;
    }
    setSelectedValueUnwrapped(nextValue);
    const shouldFillInput =
      (selectionMode() === "none" && store.context.popupRef.current && parameters.fillInputOnItemPress()) ||
      (single() && !store.peekState().inputInsidePopup);
    if (shouldFillInput) {
      setInputValue(stringifyValueLabel(nextValue), createChangeEventDetails(eventDetails.reason, eventDetails.event));
    }
  }

  function handleSelection(event: MouseEvent | PointerEvent | KeyboardEvent, itemValue: any) {
    const targetEl = getTarget(event) as HTMLElement | null;
    const overrideEvent = store.context.selectionEventRef.current ?? event;
    store.context.selectionEventRef.current = null;
    const eventDetails = createChangeEventDetails(REASONS.itemPress, overrideEvent);
    // Let the link handle the click.
    const href = targetEl?.closest("a")?.getAttribute("href");
    if (href) {
      if (href.startsWith("#")) {
        setOpen(false, eventDetails);
      }
      return;
    }
    if (multiple()) {
      const currentSelectedValue = Array.isArray(selectedValue()) ? selectedValue() : [];
      const isCurrentlySelected = selectedValueIncludes(currentSelectedValue, itemValue, comparer());
      const nextValue = isCurrentlySelected
        ? removeItem(currentSelectedValue, itemValue, comparer())
        : [...currentSelectedValue, itemValue];
      setSelectedValue(nextValue, eventDetails);
      if (eventDetails.isCanceled) {
        return;
      }
      const wasFiltering = store.context.inputRef.current ? store.context.inputRef.current.value.trim() !== "" : false;
      if (!wasFiltering) {
        return;
      }
      if (store.peekState().inputInsidePopup) {
        setInputValue(
          "",
          createChangeEventDetails(REASONS.inputClear, eventDetails.event, undefined, {
            isItemPress: true,
          }),
        );
        // A newly selected item stays highlighted through the clear; a deselection
        // falls back to the standard selection anchor.
        if (pendingQueryHighlight && !isCurrentlySelected) {
          pendingQueryHighlight.toggledValue = itemValue;
        }
      } else {
        setOpen(false, eventDetails);
      }
    } else {
      setSelectedValue(itemValue, eventDetails);
      if (eventDetails.isCanceled) {
        return;
      }
      setOpen(false, eventDetails);
    }
  }

  function requestSubmit() {
    const formElement = field.validation.inputElement?.form ?? store.peekState().inputElement?.form;
    if (formElement && typeof formElement.requestSubmit === "function") {
      formElement.requestSubmit();
    }
  }

  function handleUnmount() {
    setMounted(false);
    onOpenChangeComplete(false);
    setQueryChangedAfterOpen(false);
    setCloseQuery(null);
    if (selectionMode() === "none") {
      setIndices({ activeIndex: null, selectedIndex: null });
    } else {
      setIndices({ activeIndex: null });
    }
    // Multiple selection mode:
    // If the user typed a filter and didn't select in multiple mode, clear the input
    // after close completes to avoid mid-exit flicker and start fresh on next open.
    if (multiple() && store.context.inputRef.current && store.context.inputRef.current.value !== "" && !hadInputClear) {
      setInputValue("", createChangeEventDetails(REASONS.inputClear));
    }
    // Single selection mode:
    // - If input is rendered inside the popup, clear it so the next open is blank
    // - If input is outside the popup, sync it to the selected value
    if (single()) {
      if (store.peekState().inputInsidePopup) {
        if (store.context.inputRef.current && store.context.inputRef.current.value !== "") {
          setInputValue("", createChangeEventDetails(REASONS.inputClear));
        }
      } else {
        const stringVal = stringifyValueLabel(selectedValue());
        if (store.context.inputRef.current && store.context.inputRef.current.value !== stringVal) {
          // If no selection was made, treat this as clearing the typed filter.
          const reason = stringVal === "" ? REASONS.inputClear : REASONS.none;
          setInputValue(stringVal, createChangeEventDetails(reason));
        }
      }
    }
  }

  function forceMount() {
    if (items()) {
      // Ensure typeahead works on a closed list.
      store.context.labelsRef.current = flatFilteredValues().map(stringifyValueLabel);
    } else {
      store.set("forceMounted", true);
    }
  }

  const floatingContext = getRootFloatingContext(floatingRootContext);

  const setupDisabled = untrack(disabled);
  const setupInline = untrack(() => parameters.inline());
  const setupGrid = untrack(() => parameters.grid());
  const setupLoopFocus = untrack(() => parameters.loopFocus());
  const setupKeepHighlight = untrack(() => parameters.keepHighlight());
  const setupHighlightOnHover = untrack(() => parameters.highlightItemOnHover());
  const setupOpenOnInputClick = untrack(() => parameters.openOnInputClick());
  const setupInputInsidePopup = untrack(() => store.peekState().inputInsidePopup);
  const setupAutoHighlightMode = untrack(autoHighlightMode);
  const setupFocusItemOnOpen = untrack((): false | "auto" =>
    queryChangedAfterOpen() || (selectionMode() === "none" && !autoHighlightMode()) ? false : "auto",
  );

  // `readOnly` locks the value, not the interaction: the popup opens and can be browsed.
  // Value changes stay blocked in `ComboboxItem`, `ComboboxInput`'s keydown, `ComboboxTrigger`'s
  // typeahead, the clear/remove parts, and the hidden input's autofill handler.
  const click = createClick(floatingContext, {
    enabled: !setupDisabled && setupOpenOnInputClick,
    event: "mousedown-only",
    toggle: false,
    // Apply a small delay for touch to let mobile viewport/keyboard positioning settle.
    // This avoids top-bottom flip flickers if the preferred position is "top" when first tapping.
    touchOpenDelay: setupInputInsidePopup ? 0 : 100,
    reason: REASONS.inputPress,
  });

  const dismiss = createDismiss(floatingContext, {
    enabled: !setupDisabled && !setupInline,
    outsidePressEvent: {
      mouse: "sloppy",
      // The visual viewport (affected by the mobile software keyboard) can be
      // somewhat small. The user may want to scroll the screen to see more of
      // the popup.
      touch: "intentional",
    },
    // Without a popup, let the Escape key bubble the event up to other popups' handlers.
    bubbles: setupInline ? true : undefined,
    outsidePress(event) {
      const target = getTarget(event) as Element | null;
      return (
        !contains(store.peek("triggerElement"), target) &&
        !contains(store.context.clearRef.current, target) &&
        !contains(store.context.chipsContainerRef.current, target) &&
        !contains(store.peek("inputGroupElement"), target)
      );
    },
  });

  const listNavigation = createListNavigation(floatingContext, {
    enabled: !setupDisabled,
    id: untrack(generatedId),
    listRef: store.context.listRef,
    activeIndex: () => store.select("activeIndex") as number | null,
    selectedIndex: () => store.select("selectedIndex") as number | null,
    virtual: true,
    loopFocus: setupLoopFocus,
    allowEscape: setupLoopFocus && !setupAutoHighlightMode,
    focusItemOnOpen: setupFocusItemOnOpen,
    focusItemOnHover: setupHighlightOnHover,
    resetOnPointerLeave: !setupKeepHighlight,
    orientation: setupGrid ? "horizontal" : undefined,
    rtl: false,
    disabledIndices: EMPTY_ARRAY as Array<number>,
    grid: setupGrid ? gridNavigation : undefined,
    onNavigate(nextActiveIndex, event) {
      // Retain the highlight only while actually transitioning out or closed.
      // This callback runs from the navigation interaction's untracked effect,
      // so read the current state once without subscribing.
      const [isOpen, status] = untrack(() => [open(), transitionStatus()] as const);
      if ((!event && !isOpen) || status === "ending") {
        return;
      }
      if (!event) {
        setIndices({ activeIndex: nextActiveIndex });
      } else {
        setIndices({
          activeIndex: nextActiveIndex,
          type: store.context.keyboardActiveRef.current ? REASONS.keyboard : REASONS.pointer,
        });
      }
    },
  });

  // Records the interaction type that opened the combobox for the store's `openMethod`.
  let lastPointerDownType: ComboboxInteractionType = "";

  function recordOpenMethod(type: ComboboxInteractionType) {
    if (!store.peek("open")) {
      setOpenMethod(type);
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.defaultPrevented) {
      return;
    }
    lastPointerDownType = (event.pointerType || "") as ComboboxInteractionType;
    recordOpenMethod(lastPointerDownType);
  }

  function handleClick(event: MouseEvent | PointerEvent) {
    // `detail` counts clicks on the element; 0 means keyboard activation.
    if (event.detail === 0) {
      recordOpenMethod("keyboard");
      return;
    }
    if ("pointerType" in event) {
      recordOpenMethod(event.pointerType as ComboboxInteractionType);
    } else {
      recordOpenMethod(lastPointerDownType);
    }
    lastPointerDownType = "";
  }

  const openMethodProps = {
    onClick: handleClick,
    onPointerDown: handlePointerDown,
  };

  function getRoleReferenceProps(): Record<string, unknown> {
    const inputElement = store.select("inputElement") as HTMLInputElement | null;
    const listElement = store.select("listElement") as HTMLElement | null;
    const isPlainInput = inputElement?.tagName === "INPUT";
    // During SSR and initial hydration, the input ref is not available yet.
    // Assume an input-like control so combobox ARIA attributes are present.
    const shouldTreatAsInput = inputElement == null || isPlainInput;
    const expanded = open() || (store.select("inline") as boolean);
    // A non-input control only takes on combobox semantics while the list is exposed, which for
    // an inline list is the whole time.
    const shouldApplyAria = shouldTreatAsInput || expanded;
    const ariaHasPopup = parameters.grid() ? "grid" : "listbox";
    const ariaExpanded = expanded ? "true" : "false";
    const reference: Record<string, unknown> = shouldTreatAsInput
      ? {
          autoComplete: "off",
          spellCheck: "false",
          autoCorrect: "off",
          autoCapitalize: "none",
        }
      : {};
    if (shouldApplyAria) {
      reference.role = "combobox";
      reference["aria-expanded"] = ariaExpanded;
      reference["aria-haspopup"] = ariaHasPopup;
      reference["aria-controls"] = expanded ? listElement?.id : undefined;
      // `readOnly` accepts no input, so no completion of any kind is offered.
      reference["aria-autocomplete"] = parameters.readOnly() ? "none" : parameters.autoComplete();
    }
    return reference;
  }

  function getInputProps(): Record<string, unknown> {
    const navigationReference = listNavigation.reference();
    const dismissReference = dismiss.reference();
    const clickReference = click.reference();
    const roleReference = getRoleReferenceProps();
    const navigationKeyDown = navigationReference.onKeyDown;
    const dismissKeyDown = dismissReference.onKeyDown;
    const clickKeyDown = clickReference.onKeyDown;
    return {
      ...navigationReference,
      ...dismissReference,
      ...clickReference,
      ...roleReference,
      onKeyDown(event: KeyboardEvent) {
        // In grid mode the navigation hook treats ArrowLeft/ArrowRight as horizontal
        // grid movement. When the input has focus and no item is highlighted the user
        // is still editing the query, so let the input keep its native caret behavior.
        if (parameters.grid() && store.peek("activeIndex") == null && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          dismissKeyDown?.(event);
          return;
        }
        navigationKeyDown?.(event);
        dismissKeyDown?.(event);
        clickKeyDown?.();
      },
      onPointerDown: (event: PointerEvent) => {
        navigationReference.onPointerDown?.(event);
        dismissReference.onPointerDown?.(event);
        clickReference.onPointerDown?.(event);
      },
      onMouseDown: (event: MouseEvent) => {
        navigationReference.onMouseDown?.(event);
        clickReference.onMouseDown?.(event);
      },
      onClick: (event: MouseEvent) => {
        navigationReference.onClick?.(event);
        dismissReference.onClick?.(event);
        clickReference.onClick?.(event);
      },
      onFocus: (event: FocusEvent) => {
        navigationReference.onFocus?.(event);
      },
      onPointerEnter: (event: PointerEvent) => {
        navigationReference.onPointerEnter?.(event);
      },
    };
  }

  function getPopupProps(): Record<string, unknown> {
    return mergeInteractionProps({ ...FOCUSABLE_POPUP_PROPS }, { ...dismiss.floating() });
  }

  function getListProps(): Record<string, unknown> {
    return mergeInteractionProps({ ...listNavigation.floating() }, { role: "presentation" } as Record<string, unknown>);
  }

  function getTriggerProps(): Record<string, unknown> {
    return { ...openMethodProps };
  }

  const itemProps = (() => {
    const navigationItemProps = listNavigation.item() as unknown as Record<string, unknown> | undefined;
    if (!navigationItemProps) {
      return EMPTY_OBJECT as Record<string, unknown>;
    }
    // Combobox keeps focus on the input; item focus would incorrectly sync
    // list navigation state from DOM focus.
    return { ...navigationItemProps, onFocus: undefined };
  })();

  store.useSyncedValues(() => ({
    id: generatedId(),
    selectedValue: selectedValue(),
    open: open(),
    mounted: mounted(),
    transitionStatus: transitionStatus(),
    items: storeItems(),
    inline: parameters.inline(),
    popupProps: getPopupProps(),
    listProps: getListProps(),
    inputProps: getInputProps(),
    triggerProps: getTriggerProps(),
    itemProps,
    openMethod: renderedOpenMethod(),
    selectionMode: selectionMode(),
    name: name(),
    form: parameters.form(),
    disabled: disabled(),
    readOnly: parameters.readOnly(),
    required: parameters.required(),
    grid: parameters.grid(),
    virtualized: parameters.virtualized(),
    openOnInputClick: parameters.openOnInputClick(),
    itemToStringLabel: itemToStringLabel(),
    modal: parameters.modal(),
    autoHighlight: autoHighlightMode(),
    isItemEqualToValue: comparer(),
    submitOnItemClick: parameters.submitOnItemClick(),
    hasInputValue: hasInputValueProp,
    // `inputOwnsFormValue` is derived here rather than during render because `ComboboxInput`
    // writes it from a ref callback earlier in the same commit, and it has to land in this same
    // `update` so subscribers never observe an intermediate snapshot.
    inputOwnsFormValue: selectionMode() === "none" && (parameters.inline() || !store.peek("inputInsidePopup")),
  }));

  createEffect(
    () => ({
      triggerElement: store.select("triggerElement") as HTMLElement | null,
      inputElement: store.select("inputElement") as HTMLInputElement | null,
      positionerElement: store.select("positionerElement") as HTMLElement | null,
      insidePopup: store.select("inputInsidePopup") as boolean,
      mounted: store.select("mounted"),
    }),
    ({ triggerElement, inputElement, positionerElement, insidePopup, mounted }) => {
      const referenceElement = (insidePopup ? triggerElement : inputElement) ?? null;
      floatingRootContext.update({
        referenceElement,
        domReferenceElement: referenceElement,
        floatingElement: mounted ? positionerElement : null,
      });
      return undefined;
    },
  );

  // Resets the recorded open interaction once the combobox is closed.
  createEffect(
    () => open(),
    (isCurrentlyOpen) => {
      if (!isCurrentlyOpen && untrack(openMethod) !== null) {
        setOpenMethod(null);
      }
      return undefined;
    },
  );

  createEffect(
    () => ({
      isOpen: open(),
      cq: closeQuery(),
      currentSelectedValue: selectedValue(),
      mode: selectionMode(),
      isMultiple: multiple(),
      hasSourceItems: hasItems(),
      filtered: flatFilteredValues(),
      equal: comparer(),
    }),
    ({ isOpen, cq, currentSelectedValue, mode, isMultiple, hasSourceItems, filtered, equal }) => {
      // Closing indexes against the frozen filtered list. Reopening releases that query, so its
      // rendered coordinates must be synchronized again even though the popup is already open.
      const closeQueryReleased = previousCloseQuery !== null && cq === null;
      previousCloseQuery = cq;
      if (isOpen && (!closeQueryReleased || !hasSourceItems)) {
        return undefined;
      }
      // State-driven (not tied to the internal event path) so controlled closes
      // also clear a pointerdown that never received a matching item mouseup.
      if (!isOpen) {
        store.context.pointerDownItemRef.current = null;
      }
      if (mode === "none") {
        return undefined;
      }
      // Without `items`, look the selection up in the live registry of mounted item
      // values (the list stays mounted while closed when closed-state features need
      // it — trigger interaction and rendered-label autofill force-mount it). Mounted
      // items re-assert the index themselves when their registration moves; when
      // nothing is mounted the lookup resolves to `null` and each item re-registers
      // the index on the next open.
      // Keep the selected index in the coordinates of the list that is actually rendered.
      const registry: readonly any[] = hasSourceItems ? filtered : store.context.valuesRef.current;
      setIndices({
        selectedIndex: findSelectionIndex(registry, currentSelectedValue, equal, isMultiple),
      });
      return undefined;
    },
  );

  createEffect(
    () => ({ sourceItems: items(), filtered: flatFilteredValues() }),
    ({ sourceItems, filtered }) => {
      if (sourceItems) {
        store.context.valuesRef.current = filtered;
        store.context.listRef.current.length = filtered.length;
      }
      return undefined;
    },
  );

  createEffect(
    () => ({
      highlighted: activeIndex(),
      highlightMode: autoHighlightMode(),
      hasSourceItems: hasItems(),
      hasExternalItems: parameters.filteredItems() !== undefined,
      filtered: flatFilteredValues(),
      isInline: store.select("inline") as boolean,
      isOpen: open(),
      currentInputValue: inputValue(),
    }),
    ({ highlighted, highlightMode, hasSourceItems, hasExternalItems, filtered, isInline, isOpen, currentInputValue }) => {
      const pendingHighlight = pendingQueryHighlight;
      if (pendingHighlight) {
        // A directly rendered list remains visible when the popup state is closed, while a
        // kept-mounted Positioner is hidden and should stay inert.
        const listIsNavigable = isOpen || isInline || store.peek("positionerElement")?.hidden === false;
        if (pendingHighlight.hasQuery) {
          if (highlightMode && listIsNavigable) {
            store.set("activeIndex", 0);
          }
          pendingQueryHighlight = null;
        } else if (String(currentInputValue).trim() === "") {
          // Only handle the clear once it has committed (a controlled input may reject it),
          // so a restore cannot fire while a query is still active.
          pendingQueryHighlight = null;
          if (listIsNavigable) {
            const clearedBySelection = pendingHighlight.selection;
            if (highlightMode === "always" && !clearedBySelection && store.peek("selectionMode") === "none") {
              // There is no selection to restore in Autocomplete. Keep the first-item reset
              // synchronous so list navigation sees it before a directly rendered list closes.
              store.set("activeIndex", 0);
            }
            // Items re-mounted by the clear publish their composite indices in a follow-up
            // pass, so the item registries are mid-update here. Defer past the cascade.
            queueMicrotask(() => {
              if (
                (!store.peek("open") && !store.peek("inline")) ||
                (store.context.inputRef.current && store.context.inputRef.current.value.trim() !== "")
              ) {
                return;
              }
              // Return the highlight to the selected item, the same anchor the popup uses
              // when it first opens. Read the selection through the store so consumers can
              // pass an inline `isItemEqualToValue` or a fresh `selectedValue` array without
              // re-running this effect on every render.
              const currentSelectedValue = store.peek("selectedValue");
              const currentMode = store.peek("selectionMode");
              const isMultiple = currentMode === "multiple";
              const hasSelection =
                isMultiple && Array.isArray(currentSelectedValue)
                  ? currentSelectedValue.length > 0
                  : currentMode !== "none" && currentSelectedValue != null;
              if (hasSelection) {
                // The apply callback (and this deferred microtask) are
                // untracked, so use the compute function's snapshot instead of
                // reading the signals again (which would warn as
                // STRICT_READ_UNTRACKED and never subscribe).
                const registry = hasSourceItems || hasExternalItems ? filtered : store.context.valuesRef.current;
                // A selection-driven clear keeps the just-selected item highlighted;
                // otherwise return to the open anchor. A selection that is no longer in
                // the list drops the highlight rather than leaving it on whichever item
                // now occupies that index.
                // `findItemIndex` resolves to -1 when no value was toggled.
                const toggledIndex = findItemIndex(
                  registry,
                  pendingHighlight.toggledValue,
                  store.peek("isItemEqualToValue") as (a: any, b: any) => boolean,
                );
                store.set(
                  "activeIndex",
                  toggledIndex !== -1
                    ? toggledIndex
                    : findSelectionIndex(
                        registry,
                        currentSelectedValue,
                        store.peek("isItemEqualToValue") as (a: any, b: any) => boolean,
                        isMultiple,
                      ),
                );
              } else if (clearedBySelection) {
                store.set("activeIndex", null);
              } else if (highlightMode === "always") {
                store.set("activeIndex", 0);
              }
            });
          }
        }
      }
      if (!isOpen && !isInline) {
        return undefined;
      }
      const shouldUseFlatFilteredValues = hasSourceItems || hasExternalItems;
      const candidateItems = shouldUseFlatFilteredValues ? filtered : store.context.valuesRef.current;
      const storeActiveIndex = highlighted;
      if (storeActiveIndex == null) {
        if (highlightMode === "always" && candidateItems.length > 0) {
          store.set("activeIndex", 0);
          return undefined;
        }
        emitHighlight(undefined, -1, REASONS.none);
        return undefined;
      }
      if (storeActiveIndex >= candidateItems.length) {
        emitHighlight(undefined, -1, REASONS.none);
        store.set("activeIndex", null);
        return undefined;
      }
      const itemValue = candidateItems[storeActiveIndex];
      const previouslyHighlightedItemValue = (lastHighlight === INITIAL_LAST_HIGHLIGHT ? { value: NO_ACTIVE_VALUE } : lastHighlight).value;
      const isSameItem =
        previouslyHighlightedItemValue !== NO_ACTIVE_VALUE &&
        compareItemEquality(itemValue, previouslyHighlightedItemValue, store.peek("isItemEqualToValue") as (a: any, b: any) => boolean);
      if (lastHighlight === INITIAL_LAST_HIGHLIGHT || lastHighlight.index !== storeActiveIndex || !isSameItem) {
        emitHighlight(itemValue, storeActiveIndex, REASONS.none);
      }
      return undefined;
    },
  );

  createEffect(
    () => ({
      mode: selectionMode(),
      currentInputValue: inputValue(),
      currentSelectedValue: selectedValue(),
      isMultiple: multiple(),
    }),
    ({ mode, currentInputValue, currentSelectedValue, isMultiple }) => {
      if (mode === "none") {
        field.setFilled(String(currentInputValue) !== "");
        return undefined;
      }
      field.setFilled(isMultiple ? Array.isArray(currentSelectedValue) && currentSelectedValue.length > 0 : currentSelectedValue != null);
      return undefined;
    },
  );

  // Ensures that the active index is not set to 0 when the list is empty.
  // This avoids needing to press ArrowDown twice under certain conditions.
  createEffect(
    () => ({
      hasSourceItems: hasItems(),
      highlightMode: autoHighlightMode(),
      filteredCount: flatFilteredValues().length,
    }),
    ({ hasSourceItems, highlightMode, filteredCount }) => {
      if (hasSourceItems && highlightMode && filteredCount === 0) {
        setIndices({ activeIndex: null });
      }
      return undefined;
    },
  );

  // Render-scoped flag prevents duplicate callbacks and resets so canceled writes can retry.
  let syncedSelectedLabel = false;

  function syncInputToSelectedLabel() {
    if (!syncedSelectedLabel && inputValue() !== selectedLabelString()) {
      syncedSelectedLabel = true;
      setInputValue(selectedLabelString(), createChangeEventDetails(REASONS.none));
    }
  }

  trackValueChange(query, () => {
    if (open() && query() !== "" && query() !== String(untrack(() => parameters.defaultInputValue())) && !inputMatchesSelectedValue()) {
      setQueryChangedAfterOpen(true);
    }
  });

  trackValueChange(open, () => {
    // A controlled `open` prop can interrupt the close without calling `setOpen`.
    if (open() && closeQuery() !== null) {
      handleInterruptedReopen(false);
    }
  });

  trackValueChange(selectedValue, () => {
    if (selectionMode() === "none") {
      return;
    }
    form.clearErrors(name());
    field.setDirty(isSelectedValueDirty(selectedValue(), field.validityData.initialValue, comparer()));
    field.validation.change(selectedValue());
    if (single() && !hasInputValueProp && !inputInsidePopup()) {
      syncedSelectedLabel = false;
      syncInputToSelectedLabel();
    }
  });

  // The label catches accessor changes while the items identity restores the selected label after
  // a one-step input clear followed by a data reload. The shared sync prevents duplicate writes
  // when both change in the same commit.
  function syncInputAfterItemsOrLabelChange() {
    if (single() && !hasInputValueProp && !inputInsidePopup() && !queryChangedAfterOpen()) {
      syncedSelectedLabel = false;
      syncInputToSelectedLabel();
    }
  }

  trackValueChange(selectedLabelString, () => {
    syncedSelectedLabel = false;
    syncInputAfterItemsOrLabelChange();
  });
  trackValueChange(items, () => {
    syncedSelectedLabel = false;
    syncInputAfterItemsOrLabelChange();
  });
  trackValueChange(inputValue, () => {
    if (selectionMode() !== "none") {
      return;
    }
    form.clearErrors(name());
    field.setDirty(inputValue() !== field.validityData.initialValue);
    field.validation.change(inputValue());
  });

  store.context.setOpen = setOpen;
  store.context.setInputValue = setInputValue;
  store.context.setSelectedValue = setSelectedValue;
  store.context.setIndices = setIndices;
  store.context.handleSelection = handleSelection;
  store.context.forceMount = forceMount;
  store.context.requestSubmit = requestSubmit;
  store.context.onOpenChangeComplete = onOpenChangeComplete;

  const serializedValue = () => {
    const rawValue = fieldRawValue();
    if (Array.isArray(rawValue)) {
      return "";
    }
    return stringifyAsValue(rawValue, parameters.itemToStringValue());
  };

  const hasMultipleSelection = () => multiple() && Array.isArray(selectedValue()) && selectedValue().length > 0;
  const multipleValues = (): any[] => (multiple() && Array.isArray(selectedValue()) ? selectedValue() : []);

  function handleHiddenInputFocus() {
    // Move focus when the hidden input is focused.
    if (inputInsidePopup()) {
      (store.peek("triggerElement") as HTMLElement | null)?.focus();
      return;
    }
    (store.context.inputRef.current ?? (store.peek("triggerElement") as HTMLElement | null))?.focus();
  }

  function handleAutofillChange(event: Event) {
    // Handle browser autofill.
    if (event.defaultPrevented || disabled() || parameters.readOnly()) {
      return;
    }
    const nextValue = (event.currentTarget as HTMLInputElement | null)?.value ?? "";
    const nextValueLower = nextValue.toLowerCase();
    const details = createChangeEventDetails(REASONS.none, event as Event);
    const findSerializedMatchIndex = () =>
      store.context.valuesRef.current.findIndex(
        (candidate) =>
          stringifyAsValue(candidate, parameters.itemToStringValue()).toLowerCase() === nextValueLower ||
          stringifyValueLabel(candidate).toLowerCase() === nextValueLower,
      );
    function handleChange() {
      // Browser autofill only writes a single scalar value.
      if (multiple()) {
        return;
      }
      if (selectionMode() === "none") {
        setInputValue(nextValue, details as AriaCombobox.ChangeEventDetails);
        return;
      }
      // Preserve the original serialized matching, then fall back to rendered text,
      // which browsers can autofill for primitive values like `value="US">United States`.
      let matchingIndex = findSerializedMatchIndex();
      if (matchingIndex === -1) {
        matchingIndex = store.context.valuesRef.current.findIndex((_, index) => {
          const renderedLabel = store.context.labelsRef.current[index];
          return renderedLabel != null && renderedLabel.toLowerCase() === nextValueLower;
        });
      }
      const matchingValue = matchingIndex === -1 ? undefined : store.context.valuesRef.current[matchingIndex];
      if (matchingValue != null) {
        // `setSelectedValue` may be canceled by `onSelectedValueChange`; rely on
        // the value-change tracker to mark the field dirty and run validation only
        // when the value actually changes.
        setSelectedValue(matchingValue, details as AriaCombobox.ChangeEventDetails);
      }
    }
    // Only single-selection autofill matches against the registered values/labels.
    // `multiple` ignores autofill and `none` just writes the input value, so avoid the
    // sticky `forceMounted` mount (which never resets) for those modes.
    if (single()) {
      forceMount();
      if (items() && findSerializedMatchIndex() === -1) {
        // `forceMount` only refreshes the derived labels for the `items` prop. When
        // serialized matching misses, also mount the list so rendered labels (which can
        // differ from the serialized values) are registered for autofill matching.
        store.set("forceMounted", true);
      }
    }
    queueMicrotask(handleChange);
  }

  runOnOpenChangeComplete({
    enabled: () => !parameters.hasActionsRef,
    open,
    ref: () => {
      const positioner = store.peek("positionerElement") as HTMLElement | null;
      if (store.peek("inline") && positioner) {
        return positioner.closest('[role="dialog"]') as HTMLElement | null;
      }
      return store.context.popupRef.current;
    },
    onComplete() {
      if (!store.peek("open")) {
        handleUnmount();
      }
    },
  });

  const derivedItems: ComboboxDerivedItemsContextValue = {
    get query() {
      return query();
    },
    get hasItems() {
      return hasItems();
    },
    get filteredItems() {
      return filteredItems() as any[];
    },
    get flatFilteredValues() {
      return flatFilteredValues();
    },
  };

  return {
    store,
    open,
    inputValue: inputValue as Accessor<any>,
    inputValueString: () => String(inputValue() ?? ""),
    selectedValue,
    mounted,
    generatedId,
    disabled,
    name,
    itemProps,
    serializedValue,
    hasMultipleSelection,
    multipleValues,
    derivedItems,
    hasItems,
    forceUnmount: handleUnmount,
    handleHiddenInputFocus,
    handleAutofillChange,
  };
}

/**
 * Merges interaction prop objects, chaining event handlers in order.
 */
function mergeInteractionProps(...sources: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const source of sources) {
    if (!source) {
      continue;
    }
    for (const key of Object.keys(source)) {
      const propValue = source[key];
      const existing = merged[key];
      if (typeof propValue === "function" && key.startsWith("on") && typeof existing === "function") {
        const first = existing as (...args: Array<any>) => void;
        const second = propValue as (...args: Array<any>) => void;
        merged[key] = (...args: Array<any>) => {
          first(...args);
          second(...args);
        };
      } else {
        merged[key] = propValue;
      }
    }
  }
  return merged;
}
