import { createContext, useContext } from "../../internals/context";
import type { ToastStore } from "../store/ToastStore";

export type ToastProviderContext = ToastStore;

export const ToastProviderContext = createContext<ToastProviderContext>();

export function useToastProviderContext(): ToastProviderContext {
  const context = useContext(ToastProviderContext);
  if (context === undefined) {
    throw new Error("Rebase UI: useToastManager must be used within <Toast.Provider>.");
  }
  return context;
}
