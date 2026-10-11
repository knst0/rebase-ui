import { createContext, useContext } from "reze-js";

import type { Align, CreateAnchorPositioningReturnValue, Side } from "../../internals/anchor-positioning/createAnchorPositioning";

export interface SelectPositionerContext extends Pick<
  CreateAnchorPositioningReturnValue,
  "align" | "anchorHidden" | "arrowRef" | "arrowStyles" | "arrowUncentered" | "isPositioned" | "positionerStyles" | "refs" | "update"
> {
  side: () => Side | "none";
  align: () => Align;
  alignItemWithTriggerActive: () => boolean;
  setControlledAlignItemWithTrigger: (next: boolean | ((prev: boolean) => boolean)) => void;
  scrollUpArrowRef: { current: HTMLDivElement | null };
  scrollDownArrowRef: { current: HTMLDivElement | null };
}

export const SelectPositionerContext = createContext<SelectPositionerContext | undefined>(undefined);

export function useSelectPositionerContext(): SelectPositionerContext {
  const context = useContext(SelectPositionerContext);
  if (context === undefined) {
    throw new Error("Rebase UI: SelectPositionerContext is missing. SelectPositioner parts must be placed within <Select.Positioner>.");
  }
  return context;
}
