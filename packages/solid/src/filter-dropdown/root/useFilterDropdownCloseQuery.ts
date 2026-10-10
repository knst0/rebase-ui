import { type Accessor, createEffect, createSignal, untrack } from "solid-js";

import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import type { FilterDropdownRoot } from "./FilterDropdownRootContext";

interface UseFilterDropdownCloseQueryParameters {
  open: Accessor<boolean>;
  mounted: Accessor<boolean>;
  value: Accessor<string>;
  onValueChange: (value: string, details: FilterDropdownRoot.ChangeEventDetails) => void;
}

/**
 * Clears the committed value when a filter popup closes while retaining the displayed query and
 * filtered items until the exit transition completes.
 */
export function useFilterDropdownCloseQuery(parameters: UseFilterDropdownCloseQueryParameters): Accessor<string> {
  const { open, mounted, value, onValueChange } = parameters;

  const [closeQuery, setCloseQuery] = createSignal<string | null>(null);
  let previousOpen = untrack(open);

  createEffect(
    () => ({ open: open(), mounted: mounted(), value: value(), closeQuery: closeQuery() }),
    ({ open: isOpen, mounted: isMounted, value: currentValue, closeQuery: currentCloseQuery }) => {
      const wasOpen = previousOpen;
      previousOpen = isOpen;
      if (wasOpen && !isOpen && currentValue !== "") {
        setCloseQuery(currentValue);
        untrack(() => onValueChange("", createChangeEventDetails(REASONS.popupClose)));
      } else if ((isOpen || !isMounted) && currentCloseQuery !== null) {
        setCloseQuery(null);
      }
      return undefined;
    },
  );

  return () => (!open() && closeQuery() !== null ? (closeQuery() as string) : value());
}
