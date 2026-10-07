import type { CreateAnchorPositioningReturnValue } from "../../internals/anchor-positioning/createAnchorPositioning";
import { createContext, useContext } from "../../internals/context";

export type PopoverPositionerContext = Pick<
  CreateAnchorPositioningReturnValue,
  "side" | "align" | "arrowRef" | "arrowUncentered" | "arrowStyles"
>;

export const PopoverPositionerContext = createContext<PopoverPositionerContext>();

export function usePopoverPositionerContext(): PopoverPositionerContext {
  const context = useContext(PopoverPositionerContext);
  if (context === undefined) {
    throw new Error("Rebase UI: PopoverPositionerContext is missing. PopoverPositioner parts must be placed within <Popover.Positioner>.");
  }
  return context;
}
