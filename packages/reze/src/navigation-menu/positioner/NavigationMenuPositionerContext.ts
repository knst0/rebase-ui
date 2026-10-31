import { createContext, useContext } from "reze-js";

import type { CreateAnchorPositioningReturnValue } from "../../internals/anchor-positioning/createAnchorPositioning";

export type NavigationMenuPositionerContext = Pick<
  CreateAnchorPositioningReturnValue,
  "side" | "align" | "physicalSide" | "anchorHidden" | "arrowRef" | "arrowUncentered" | "arrowStyles"
>;

export const NavigationMenuPositionerContext = createContext<NavigationMenuPositionerContext | undefined>(undefined);

export function useNavigationMenuPositionerContext(): NavigationMenuPositionerContext;
export function useNavigationMenuPositionerContext(optional: true): NavigationMenuPositionerContext | undefined;
export function useNavigationMenuPositionerContext(optional?: boolean) {
  const context = useContext(NavigationMenuPositionerContext);
  if (context === undefined && !optional) {
    throw new Error("Rebase UI: NavigationMenuPositionerContext is missing. Parts must be placed within <NavigationMenu.Positioner>.");
  }
  return context;
}
