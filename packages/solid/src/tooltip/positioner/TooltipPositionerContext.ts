import type { CreateAnchorPositioningReturnValue } from "../../internals/anchor-positioning/createAnchorPositioning";
import { createContext, useContext } from "../../internals/context";

export type TooltipPositionerContext = Pick<
  CreateAnchorPositioningReturnValue,
  "side" | "align" | "arrowRef" | "arrowUncentered" | "arrowStyles"
>;

export const TooltipPositionerContext = createContext<TooltipPositionerContext>();

export function useTooltipPositionerContext(): TooltipPositionerContext {
  const context = useContext(TooltipPositionerContext);
  if (context === undefined) {
    throw new Error("Rebase UI: TooltipPositionerContext is missing. TooltipPositioner parts must be placed within <Tooltip.Positioner>.");
  }
  return context;
}
