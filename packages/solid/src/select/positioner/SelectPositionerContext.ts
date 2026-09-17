import type { Setter } from "solid-js";

import type { Align, CreateAnchorPositioningReturnValue, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { createContext, useContext } from "../../internals/context";

export interface SelectPositionerContext extends Pick<
  CreateAnchorPositioningReturnValue,
  "align" | "anchorHidden" | "arrowRef" | "arrowStyles" | "arrowUncentered" | "isPositioned" | "positionerStyles" | "refs" | "update"
> {
  side: () => Side | "none";
  align: () => Align;
  alignItemWithTriggerActive: () => boolean;
  setControlledAlignItemWithTrigger: Setter<boolean>;
  scrollUpArrowRef: { current: HTMLDivElement | null };
  scrollDownArrowRef: { current: HTMLDivElement | null };
}

export const SelectPositionerContext = createContext<SelectPositionerContext>();

export function useSelectPositionerContext(): SelectPositionerContext {
  const context = useContext(SelectPositionerContext);
  if (context === undefined) {
    throw new Error("Rebase UI: SelectPositionerContext is missing. SelectPositioner parts must be placed within <Select.Positioner>.");
  }
  return context;
}
