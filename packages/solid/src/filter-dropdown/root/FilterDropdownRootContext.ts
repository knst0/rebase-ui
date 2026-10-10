import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { REASONS, RebaseUIChangeEventDetails } from "../../internals/event-details";
import type { FilterDropdownStore } from "../store";

export interface FilterDropdownItemRegistration {
  getText: () => string | undefined;
}

export type FilterDropdownFilter = (text: string, query: string) => boolean;

export interface FilterDropdownRootContext {
  open: Accessor<boolean>;
  disabled: Accessor<boolean>;
  inputFocusVisible: Accessor<boolean>;
  setInputFocusVisible: (visible: boolean) => void;
  keyboardModality: Accessor<boolean>;
  setKeyboardModality: (keyboardModality: boolean) => void;
  autoHighlight: boolean | "always";
  triggerId: Accessor<string | undefined>;
  defaultListId: string | undefined;
  listId: Accessor<string | undefined>;
  /** Records the id the list rendered with, when it differs from `defaultListId`. */
  setRenderedListId: (id: string | undefined) => void;
  /** The input, which owns real focus while the host uses virtual list navigation. */
  focusOwnerRef: { current: HTMLElement | null };
  /** Moves the host's highlight. */
  setActiveIndex: (index: number | null) => void;
  /** Called with the previous items when the host's list changes after it first registered. */
  onItemsChange: (previousItems: readonly (HTMLElement | null)[]) => void;
  /** Reports a query edit and resets the highlight it invalidates. */
  onValueChange: (value: string, eventDetails: FilterDropdownRoot.ChangeEventDetails) => void;
}

export interface FilterDropdownItemContext {
  /** The enclosing dropdown when this root is nested. */
  parent: FilterDropdownItemContext | null;
  store: FilterDropdownStore;
  registerItem: (id: symbol, registration: FilterDropdownItemRegistration) => () => void;
  listRef: { current: Array<HTMLElement | null> };
}

function throwMissingFilterRoot(): never {
  throw new Error(
    "Rebase UI: Filter parts are missing their filter context and cannot access the query or items. " +
      "Wrap the component root in its filter provider.",
  );
}

export const FilterDropdownItemContext = createContext<FilterDropdownItemContext | null>();

export function useFilterDropdownItemContext(optional?: false): FilterDropdownItemContext;
export function useFilterDropdownItemContext(optional: true): FilterDropdownItemContext | null;
export function useFilterDropdownItemContext(optional?: boolean): FilterDropdownItemContext | null {
  const context = useContext(FilterDropdownItemContext);
  if ((context === undefined || context === null) && !optional) {
    throwMissingFilterRoot();
  }
  return (context ?? null) as FilterDropdownItemContext | null;
}

export const FilterDropdownRootContext = createContext<FilterDropdownRootContext | null>();

export function useFilterDropdownRootContext(optional?: false): FilterDropdownRootContext;
export function useFilterDropdownRootContext(optional: true): FilterDropdownRootContext | null;
export function useFilterDropdownRootContext(optional?: boolean): FilterDropdownRootContext | null {
  const context = useContext(FilterDropdownRootContext);
  if ((context === undefined || context === null) && !optional) {
    throwMissingFilterRoot();
  }
  return (context ?? null) as FilterDropdownRootContext | null;
}

/**
 * Finds the dropdown that owns the given item list, walking out through nested roots.
 */
export function useFilterContextForList(listRef: { current: Array<HTMLElement | null> } | null) {
  let context = useContext(FilterDropdownItemContext) ?? null;
  if (listRef === null) {
    return null;
  }

  while (context !== null && context.listRef !== listRef) {
    context = context.parent;
  }
  return context;
}

// `value` controls a native input and can't be placed in the store without breaking the caret
// position when the input is controlled.
// https://github.com/mui/base-ui/issues/2703
export const FilterDropdownValueContext = createContext<Accessor<string>>();

export function useFilterDropdownValueContext(): Accessor<string> {
  const context = useContext(FilterDropdownValueContext);
  if (context === undefined) {
    throwMissingFilterRoot();
  }
  return context;
}

export type FilterDropdownRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.clearPress
  | typeof REASONS.popupClose;

export type FilterDropdownRootChangeEventDetails = RebaseUIChangeEventDetails<FilterDropdownRootChangeEventReason>;

export namespace FilterDropdownRoot {
  export type ChangeEventReason = FilterDropdownRootChangeEventReason;
  export type ChangeEventDetails = FilterDropdownRootChangeEventDetails;
}
