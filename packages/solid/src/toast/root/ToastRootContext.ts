import type { Setter } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { ToastObject } from "../useToastManager";

export interface ToastRootContext {
  toast: () => ToastObject<any>;
  setTitleId: Setter<string | undefined>;
  setDescriptionId: Setter<string | undefined>;
  visibleIndex: () => number;
  expanded: () => boolean;
  recalculateHeight: () => void;
}

export const ToastRootContext = createContext<ToastRootContext>();

export function useToastRootContext(): ToastRootContext {
  const context = useContext(ToastRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ToastRootContext is missing. Toast parts must be used within <Toast.Root>.");
  }
  return context;
}
