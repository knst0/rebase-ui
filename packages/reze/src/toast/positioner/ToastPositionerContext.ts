import { createContext, useContext } from "reze-js";

import type { CreateAnchorPositioningReturnValue } from "../../internals/anchor-positioning/createAnchorPositioning";

export type ToastPositionerContext = Pick<
  CreateAnchorPositioningReturnValue,
  "side" | "align" | "arrowRef" | "arrowUncentered" | "arrowStyles"
>;

export const ToastPositionerContext = createContext<ToastPositionerContext | undefined>(undefined);

export function useToastPositionerContext(): ToastPositionerContext {
  const context = useContext(ToastPositionerContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ToastPositionerContext is missing. ToastPositioner parts must be placed within <Toast.Positioner>.");
  }
  return context;
}
