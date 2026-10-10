import type { JSX } from "@solidjs/web";
import { createEffect, createMemo, createSignal, createUniqueId, untrack } from "solid-js";

import { createItemRegistry } from "../../internals/createItemRegistry";
import { getFilter } from "../../internals/filter";
import { stableCallback } from "../../internals/stableCallback";
import { FilterDropdownStore } from "../store";
import {
  FilterDropdownItemContext,
  FilterDropdownRootContext,
  FilterDropdownValueContext,
  useFilterDropdownItemContext,
  type FilterDropdownFilter,
  type FilterDropdownItemContext as FilterDropdownItemContextValue,
  type FilterDropdownItemRegistration,
  type FilterDropdownRootContext as FilterDropdownRootContextValue,
  type FilterDropdownRoot as FilterDropdownRootNamespace,
} from "./FilterDropdownRootContext";

/**
 * Holds the filter query, matches it against the registered items, and publishes the result. The
 * host owns list navigation; this root moves the highlight through `setActiveIndex`.
 *
 * @internal
 */
export function FilterDropdownRoot(props: FilterDropdownRoot.Props): JSX.Element {
  const parentItemContext = useFilterDropdownItemContext(true);

  const [renderedListId, setRenderedListId] = createSignal<string | undefined>(undefined);
  const [inputFocusVisible, setInputFocusVisible] = createSignal(untrack(() => props.openedByKeyboard) ?? false);
  const [keyboardModality, setKeyboardModality] = createSignal(untrack(() => props.openedByKeyboard) ?? false);

  const registry = createItemRegistry<symbol, FilterDropdownItemRegistration>();
  const store = new FilterDropdownStore();

  // The count is published as items register, not with the next registry snapshot, so a
  // `Menu.Empty` mounting alongside the items never reads a stale zero.
  const registerItem = (id: symbol, item: FilterDropdownItemRegistration) => {
    const unregister = registry.registerItem(id, item);
    store.set("registeredItemCount", registry.liveItems.size);
    return () => {
      unregister();
      store.set("registeredItemCount", registry.liveItems.size);
    };
  };

  const focusOwnerRef = untrack(() => props.focusOwnerRef) ?? { current: null as HTMLElement | null };
  let lastFilterQuery: string | null = null;

  const defaultMatchItem = createMemo(() => getFilter({ locale: props.locale }).contains);
  const defaultId = createUniqueId();

  const filterQuery = () => (props.query ?? props.value).trim();
  // An unused inline filter must not re-run auto-highlighting when the consumer re-renders.
  const matchItem = () => {
    const query = filterQuery();
    const filter = props.filter;
    return query === "" || filter === null ? null : (filter ?? defaultMatchItem());
  };
  const autoHighlightEnabled = () => {
    const autoHighlight = props.autoHighlight ?? false;
    return props.open && (autoHighlight === "always" || (autoHighlight && filterQuery() !== ""));
  };
  const defaultListId = `${defaultId}-list`;
  const listId = () => renderedListId() ?? defaultListId;
  // The host owns the trigger. `null` and `''` both mean no element carries an id to point at.
  const triggerId = createMemo(() => props.triggerId || undefined);

  const getActiveIndex = stableCallback(() => props.getActiveIndex);
  const setActiveIndex = stableCallback(() => props.setActiveIndex);
  const onValueChangeProp = stableCallback(() => props.onValueChange);

  function handleValueChange(nextValue: string, eventDetails: FilterDropdownRootNamespace.ChangeEventDetails) {
    untrack(() => onValueChangeProp(nextValue, eventDetails));
    // Indexes are positional, so a kept highlight would land on whatever fills its slot.
    // With `autoHighlight`, the filtering effect below places the highlight instead.
    const autoHighlight = untrack(() => props.autoHighlight) ?? false;
    if (!eventDetails.isCanceled && !autoHighlight) {
      untrack(() => setActiveIndex(null));
    }
  }

  function handleItemsChange(previousItems: readonly (HTMLElement | null)[]) {
    const items = untrack(() => props.listRef).current;
    const activeIndex = untrack(getActiveIndex);

    // A positional highlight must not silently move to another item. A change that leaves the
    // highlighted item in place keeps it, such as an item appended after it or one that renders
    // once before the query filters it out. A query change already reset the highlight.
    if (activeIndex != null && items[activeIndex] != null && items[activeIndex] === previousItems[activeIndex]) {
      return;
    }

    untrack(() => setActiveIndex(untrack(autoHighlightEnabled) && items.length > 0 ? 0 : null));
  }

  // Re-runs on the registry snapshot published once every item in the commit has registered,
  // and on the committed query, because a controlled consumer can reject a proposed change. It
  // reads the live registry so items registered in this commit count before their snapshot.
  createEffect(
    () => ({
      open: props.open,
      query: props.query,
      filterQuery: filterQuery(),
      registeredItems: registry.items(),
      matchItem: matchItem(),
      autoHighlightEnabled: autoHighlightEnabled(),
    }),
    ({ open, query, filterQuery: currentQuery, matchItem: matcher, autoHighlightEnabled: highlightEnabled }) => {
      if (!open && query === undefined) {
        return undefined;
      }

      const queryChanged = lastFilterQuery !== null && lastFilterQuery !== currentQuery;
      lastFilterQuery = currentQuery;
      const liveItems = registry.liveItems;

      // With no query or external filtering, every registered item is visible. External filtering
      // still follows `autoHighlight`; otherwise the item set invalidates the highlight.
      if (matcher === null) {
        store.set("visibleItemIds", null);
        // Registry updates, such as an item's text changing, keep the current highlight.
        if (highlightEnabled && liveItems.size > 0) {
          if (queryChanged || untrack(getActiveIndex) == null) {
            untrack(() => setActiveIndex(0));
          }
        } else if (currentQuery === "" && queryChanged) {
          untrack(() => setActiveIndex(null));
        }
        return undefined;
      }

      const currentIds = store.peek("visibleItemIds");
      // The popup's content mounts a commit after the root opens. Publishing an empty result before
      // anything registered would hide every item as it arrives and remount the matches.
      if (currentIds === null && liveItems.size === 0) {
        return undefined;
      }

      const nextIds = new Set<symbol>();
      let hasNewMatch = currentIds === null;
      liveItems.forEach(({ getText }, id) => {
        const text = getText();
        if (text != null && (matcher as FilterDropdownFilter)(text, currentQuery)) {
          nextIds.add(id);
          hasNewMatch ||= !currentIds?.has(id);
        }
      });

      // New matches or a smaller result set invalidate the previous item identities.
      if (hasNewMatch || currentIds?.size !== nextIds.size) {
        // The first filtered snapshot can land after initial keyboard navigation. It
        // has no prior result identity to invalidate, unless the controlled query itself changed.
        if (highlightEnabled && nextIds.size > 0) {
          untrack(() => setActiveIndex(0));
        } else if (currentIds !== null || queryChanged) {
          untrack(() => setActiveIndex(null));
        }
        store.set("visibleItemIds", nextIds);
      } else if (highlightEnabled && queryChanged && nextIds.size > 0) {
        untrack(() => setActiveIndex(0));
      }
      return undefined;
    },
  );

  const valueAccessor = () => props.query ?? props.value;

  const contextValue: FilterDropdownRootContextValue = {
    open: () => props.open,
    disabled: () => props.disabled ?? false,
    inputFocusVisible,
    setInputFocusVisible,
    keyboardModality,
    setKeyboardModality,
    autoHighlight: untrack(() => props.autoHighlight) ?? false,
    triggerId,
    defaultListId,
    listId,
    setRenderedListId,
    focusOwnerRef,
    setActiveIndex: (index) => untrack(() => setActiveIndex(index)),
    onItemsChange: handleItemsChange,
    onValueChange: handleValueChange,
  };

  const itemContextValue: FilterDropdownItemContextValue = {
    parent: parentItemContext,
    store,
    registerItem,
    listRef: untrack(() => props.listRef),
  };

  return (
    <FilterDropdownItemContext value={itemContextValue}>
      <FilterDropdownRootContext value={contextValue}>
        <FilterDropdownValueContext value={valueAccessor}>{props.children}</FilterDropdownValueContext>
      </FilterDropdownRootContext>
    </FilterDropdownItemContext>
  );
}

export interface FilterDropdownRootProps {
  children?: JSX.Element;
  /**
   * Whether the popup is currently open.
   */
  open: boolean;
  /** Whether the filter controls should be disabled. */
  disabled?: boolean | undefined;
  /** Whether the popup opened from the keyboard, so the input starts with its focus ring. */
  openedByKeyboard?: boolean | undefined;
  /**
   * Locale used for filtering comparisons.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The filter input value.
   */
  value: string;
  /**
   * Query used for filtering when it differs from the input value, such as while closing.
   */
  query?: string | undefined;
  /**
   * Event handler called when the filter input value changes.
   */
  onValueChange?: ((value: string, eventDetails: FilterDropdownRootNamespace.ChangeEventDetails) => void) | undefined;
  /**
   * Custom filter logic used when filtering items. Pass `null` to turn filtering off.
   */
  filter?: FilterDropdownFilter | null | undefined;
  /** Whether the first matching item should be highlighted automatically. */
  autoHighlight?: boolean | "always" | undefined;
  /**
   * ID of a trigger rendered outside this root, which cannot register itself through the context.
   */
  triggerId?: string | null | undefined;
  /**
   * Ref of the host's item list, which the highlight moves through.
   */
  listRef: { current: Array<HTMLElement | null> };
  /**
   * Reads the host's highlighted index.
   */
  getActiveIndex: () => number | null;
  /**
   * Moves the host's highlight.
   */
  setActiveIndex: (index: number | null) => void;
  /**
   * Ref of the element holding real focus while the host navigates virtually.
   */
  focusOwnerRef?: { current: HTMLElement | null } | undefined;
}

export namespace FilterDropdownRoot {
  export type Props = FilterDropdownRootProps;
}
