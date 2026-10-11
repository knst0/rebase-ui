import { effect, store as createStore, untrack } from "reze-js";

import { createChangeEventDetails } from "../../internals/event-details";
import { popupCloseReason, type FilterDropdownRoot } from "./FilterDropdownRootContext";

interface UseFilterDropdownCloseQueryParameters {
  open: () => boolean;
  mounted: () => boolean;
  value: () => string;
  onValueChange: (value: string, details: FilterDropdownRoot.ChangeEventDetails) => void;
}

/**
 * Clears the committed value when a filter popup closes while retaining the displayed query and
 * filtered items until the exit transition completes.
 */
export function useFilterDropdownCloseQuery(parameters: UseFilterDropdownCloseQueryParameters): () => string {
  const { open, mounted, value, onValueChange } = parameters;

  const state = createStore({ closeQuery: null as string | null });
  let previousOpen = untrack(open);

  effect(() => {
    const deps = { open: open(), mounted: mounted(), value: value(), closeQuery: state.closeQuery };

    // One-shot continuation: the stored query below is consumed, never tracked.
    untrack(() => {
      const wasOpen = previousOpen;
      previousOpen = deps.open;
      if (wasOpen && !deps.open && deps.value !== "") {
        if (state.closeQuery !== deps.value) {
          state.closeQuery = deps.value;
        }
        onValueChange("", createChangeEventDetails(popupCloseReason));
      } else if ((deps.open || !deps.mounted) && deps.closeQuery !== null) {
        state.closeQuery = null;
      }
    });
  });

  return () => (!open() && state.closeQuery !== null ? (state.closeQuery as string) : value());
}
