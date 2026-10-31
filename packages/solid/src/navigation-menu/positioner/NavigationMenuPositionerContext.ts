import type { CreateAnchorPositioningReturnValue } from "../../internals/anchor-positioning/createAnchorPositioning";
import { createContext, useContext } from "../../internals/context";

export type NavigationMenuPositionerContext = Pick<
  CreateAnchorPositioningReturnValue,
  "side" | "align" | "physicalSide" | "anchorHidden" | "arrowRef" | "arrowUncentered" | "arrowStyles"
>;

export const NavigationMenuPositionerContext = createContext<NavigationMenuPositionerContext>();

export function useNavigationMenuPositionerContext(): NavigationMenuPositionerContext;
export function useNavigationMenuPositionerContext(optional: true): NavigationMenuPositionerContext | undefined;
export function useNavigationMenuPositionerContext(optional?: boolean) {
  const context = useContext(NavigationMenuPositionerContext);
  if (context === undefined && !optional) {
    throw new Error("Rebase UI: NavigationMenuPositionerContext is missing. Parts must be placed within <NavigationMenu.Positioner>.");
  }
  return context;
}
