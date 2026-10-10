import { createContext, useContext } from "../../internals/context";
import type { FloatingRootStore } from "../../internals/floating/tree/FloatingRootStore";
import type { SelectStore } from "../store/SelectStore";

export const SelectRootContext = createContext<SelectStore>();
export const SelectFloatingContext = createContext<FloatingRootStore>();

export function useSelectRootContext(): SelectStore {
  const store = useContext(SelectRootContext);
  if (store === undefined) {
    throw new Error("Rebase UI: SelectRootContext is missing. Select parts must be placed within <Select.Root>.");
  }
  return store;
}

export function useSelectFloatingContext(): FloatingRootStore {
  const context = useContext(SelectFloatingContext);
  if (context === undefined) {
    throw new Error("Rebase UI: SelectFloatingContext is missing. Select parts must be placed within <Select.Root>.");
  }
  return context;
}
