import type { FloatingRootStore } from "../../internals/floating/tree/FloatingRootStore";
import { createContext, useContext } from "../../internals/context";
import type { SelectStore } from "../store/SelectStore";

/**
 * Root values consumed during render. Kept outside the store so descendant ref
 * callbacks see the current props during the same commit.
 */
export interface SelectRootPropsContextValue {
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  multiple: boolean;
  highlightItemOnHover: boolean;
  itemProps: Record<string, unknown>;
}

export const SelectRootContext = createContext<SelectStore>();
export const SelectRootPropsContext = createContext<SelectRootPropsContextValue>();
export const SelectFloatingContext = createContext<FloatingRootStore>();

export function useSelectRootContext(): SelectStore {
  const store = useContext(SelectRootContext);
  if (store === undefined) {
    throw new Error(
      "Rebase UI: SelectRootContext is missing. Select parts must be placed within <Select.Root>.",
    );
  }
  return store;
}

export function useSelectRootPropsContext(): SelectRootPropsContextValue {
  const context = useContext(SelectRootPropsContext);
  if (context === undefined) {
    throw new Error(
      "Rebase UI: SelectRootPropsContext is missing. Select parts must be placed within <Select.Root>.",
    );
  }
  return context;
}

export function useSelectFloatingContext(): FloatingRootStore {
  const context = useContext(SelectFloatingContext);
  if (context === undefined) {
    throw new Error(
      "Rebase UI: SelectFloatingContext is missing. Select parts must be placed within <Select.Root>.",
    );
  }
  return context;
}
