import { effect, onCleanup, store as createStore, untrack } from "reze-js";

import { useFilterDropdownGroupContext } from "../group/FilterDropdownGroupContext";
import { useFilterDropdownItemContext, type FilterDropdownItemContext } from "../root/FilterDropdownRootContext";
import { DETACHED_OWNER } from "../store";

export interface UseFilterDropdownItemParameters {
  /**
   * A text representation of the item used for filtering. Falls back to the rendered text.
   */
  label?: string | undefined;
  /**
   * Keeps the nearest group visible while this filtered-out item must remain mounted.
   */
  retainGroup?: boolean | undefined;
  /**
   * The dropdown that owns this item, when it isn't the nearest one. A filterable submenu's
   * trigger sits inside its own submenu's root but belongs to the enclosing list.
   */
  context?: FilterDropdownItemContext | null | undefined;
}

export interface UseFilterDropdownItemReturnValue {
  /**
   * Whether the item matches the current query and should render.
   */
  visible: () => boolean;
  /**
   * Ref for the rendered element, used to read its text when no `label` is given.
   */
  ref: { current: HTMLElement | null };
}

/**
 * Registers an item with the enclosing filter root and reports whether the query keeps it.
 *
 * The item renders once before it is registered so its rendered text can be read and cached: a
 * popup can open with a query that already excludes the item, and a hidden item has no text left
 * to match against.
 *
 * @internal
 */
export function useFilterDropdownItem(params: UseFilterDropdownItemParameters): UseFilterDropdownItemReturnValue {
  const nearestContext = params.context !== undefined ? useFilterDropdownItemContext(true) : useFilterDropdownItemContext();
  const groupContext = useFilterDropdownGroupContext();

  const owner = params.context === undefined ? nearestContext : params.context;
  const { registerItem, store } = owner ?? DETACHED_OWNER;
  const registerGroupItem = groupContext?.registerItem;

  const itemId = Symbol("filter-dropdown-item");
  const ref = { current: null as HTMLElement | null };
  let registeredText: string | undefined;

  function matched(): boolean {
    return store.isItemVisible(itemId);
  }

  // An initial item is visible before registration (`visibleItemIds` is null), so start
  // registered and skip the mount re-render. A late item under an active filter starts
  // unregistered and renders once so its DOM text can be captured.
  const state = createStore({ registered: untrack(matched) });

  function resolveText(): string | undefined {
    if (params.label != null) {
      return params.label;
    }
    // The rendered text is the fallback. Children are deliberately not read: a children getter
    // executes the child's setup on every read. Items always render once before the query can
    // filter them out, so the element (or its cached text) is available by match time.
    if (ref.current !== null) {
      return ref.current.textContent ?? "";
    }
    return registeredText;
  }

  function register(resolvedText?: string) {
    const text = resolvedText ?? untrack(resolveText);
    if (text) {
      registeredText = text;
    }
    return registerItem(itemId, {
      getText() {
        // A mounted item reports what it renders now, even nothing, since a descendant can change
        // its text without the item re-rendering. A filtered-out item falls back to the cached
        // text.
        if (params.label == null && ref.current) {
          registeredText = ref.current.textContent ?? "";
        }
        return registeredText;
      },
    });
  }

  const unregister = untrack(() => register());
  if (!untrack(() => state.registered)) {
    state.registered = true;
  }
  onCleanup(unregister);

  const unregisterGroupItem = registerGroupItem?.(itemId, params.retainGroup ?? false);
  if (unregisterGroupItem) {
    onCleanup(unregisterGroupItem);
  }

  // Re-register when the item's label changes, so the active query runs again.
  effect(() => {
    // Read for parity with the Solid layer; `params` is a plain object, so this documents
    // the dependency without subscribing.
    const label = params.label;

    untrack(() => {
      if (!state.registered) {
        return;
      }
      const text = resolveText();
      if (text !== registeredText) {
        registeredText = text;
        void register(text);
      }
    });

    void label;
  });

  function visible(): boolean {
    return !state.registered || matched();
  }

  return { visible, ref };
}
