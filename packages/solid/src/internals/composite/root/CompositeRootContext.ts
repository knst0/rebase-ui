import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../context";

export type CompositeItemMetadata = Record<string, any>;

export interface CompositeRootContext {
  highlightedIndex: Accessor<number>;
  setHighlightedIndex: (index: number, shouldScrollIntoView?: boolean) => void;
  highlightItemOnHover: Accessor<boolean>;
  elements: Accessor<HTMLElement[]>;
  metadataMap: Accessor<Map<HTMLElement, CompositeItemMetadata>>;
  /** Document-order position of a registered element, or `-1`. Reactive and O(1). */
  indexOf: (element: HTMLElement | null) => number;
  /**
   * Reserves the static `tabIndex` an item renders with, before any element exists.
   * Returns `0` for the item whose render position matches the highlighted index so
   * server-rendered and pre-effect markup still exposes exactly one tab stop.
   */
  claimInitialTabIndex: () => number;
  registerItem: (element: HTMLElement, metadata?: CompositeItemMetadata) => void;
  unregisterItem: (element: HTMLElement) => void;
  /**
   * Makes it possible to control composite components using events that don't originate
   * from their children. Keyboard events that occur outside of the composite root can be
   * forwarded manually using this function.
   */
  relayKeyboardEvent: (event: KeyboardEvent) => void;
}

export const CompositeRootContext = createContext<CompositeRootContext>();

export function useCompositeRootContext(optional?: true): CompositeRootContext | undefined;
export function useCompositeRootContext(optional: false): CompositeRootContext;
export function useCompositeRootContext(optional = true): CompositeRootContext | undefined {
  const context = useContext(CompositeRootContext);

  if (context === undefined && !optional) {
    throw new Error("Rebase UI: CompositeRootContext is missing. Composite parts must be placed within <Composite.Root>.");
  }

  return context;
}
