import type { CreateAnchorPositioningReturnValue } from "../../internals/anchor-positioning/createAnchorPositioning";
import { createContext, useContext } from "../../internals/context";

export type ToastPositionerContext = Pick<
  CreateAnchorPositioningReturnValue,
  "side" | "align" | "arrowRef" | "arrowUncentered" | "arrowStyles"
>;

export const ToastPositionerContext = createContext<ToastPositionerContext>();

export function useToastPositionerContext(): ToastPositionerContext {
  const context = useContext(ToastPositionerContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ToastPositionerContext is missing. ToastPositioner parts must be placed within <Toast.Positioner>.");
  }
  return context;
}
