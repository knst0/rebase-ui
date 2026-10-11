import { createContext, useContext } from "reze-js";

import type { ToastObject } from "../useToastManager";

export type ToastRootLabelIdSetter = (next: string | undefined | ((prev: string | undefined) => string | undefined)) => void;

export interface ToastRootContext {
  toast: () => ToastObject<any>;
  setTitleId: ToastRootLabelIdSetter;
  setDescriptionId: ToastRootLabelIdSetter;
  visibleIndex: () => number;
  expanded: () => boolean;
  recalculateHeight: () => void;
}

export const ToastRootContext = createContext<ToastRootContext | undefined>(undefined);

export function useToastRootContext(): ToastRootContext {
  const context = useContext(ToastRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ToastRootContext is missing. Toast parts must be used within <Toast.Root>.");
  }
  return context;
}
