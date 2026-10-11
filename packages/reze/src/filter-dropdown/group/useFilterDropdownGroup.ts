import { effect, onCleanup, untrack } from "reze-js";

import { createItemRegistry } from "../../internals/createItemRegistry";
import { useFilterDropdownItemContext } from "../root/FilterDropdownRootContext";
import type { FilterDropdownState } from "../store";
import { useFilterDropdownGroupContext, type FilterDropdownGroupContext } from "./FilterDropdownGroupContext";

function isGroupHidden(state: FilterDropdownState, items: ReadonlyMap<symbol, boolean>) {
  // A group with no members hasn't been filtered out, it hasn't registered yet.
  if (state.visibleItemIds === null || items.size === 0) {
    return false;
  }
  for (const [id, retained] of items) {
    if (retained || state.visibleItemIds.has(id)) {
      return false;
    }
  }
  return true;
}

export interface UseFilterDropdownGroupReturnValue {
  /**
   * Whether the query filtered out every item in the group, so its label doesn't linger over an
   * empty section.
   */
  hidden: () => boolean;
  /**
   * Provider value that collects the group's items.
   */
  context: FilterDropdownGroupContext;
}

/**
 * Tracks which items belong to a group and hides the group once none of them match.
 *
 * @internal
 */
export function useFilterDropdownGroup(): UseFilterDropdownGroupReturnValue {
  const { store } = useFilterDropdownItemContext();
  const parentContext = useFilterDropdownGroupContext();

  const registry = createItemRegistry<symbol, boolean>();

  function hidden(): boolean {
    return isGroupHidden(
      { visibleItemIds: store.select("visibleItemIds"), registeredItemCount: store.select("registeredItemCount") },
      registry.items(),
    );
  }

  // A nested container collects its own items, so the enclosing one only ever sees this
  // registration. Report visibility upward or a group of groups would look empty.
  const groupId = Symbol("filter-dropdown-group");
  const registerInParent = parentContext?.registerItem;

  effect(() => {
    const isHidden = hidden();
    const unregister = untrack(() => registerInParent?.(groupId, !isHidden));
    onCleanup(() => unregister?.());
  });

  const context: FilterDropdownGroupContext = {
    registerItem: (id, retained) => untrack(() => registry.registerItem(id, retained)),
  };

  return { hidden, context };
}
