import { createContext, useContext } from "reze-js";

import type { CreateAnchorPositioningReturnValue } from "../../internals/anchor-positioning/createAnchorPositioning";

export type MenuPositionerContext = Pick<
  CreateAnchorPositioningReturnValue,
  "side" | "align" | "arrowRef" | "arrowUncentered" | "arrowStyles"
>;

export const MenuPositionerContext = createContext<MenuPositionerContext | undefined>(undefined);

export function useMenuPositionerContext(optional?: false): MenuPositionerContext;
export function useMenuPositionerContext(optional: true): MenuPositionerContext | undefined;
export function useMenuPositionerContext(optional?: boolean): MenuPositionerContext | undefined {
  const context = useContext(MenuPositionerContext);

  if (context === undefined && !optional) {
    throw new Error("Rebase UI: MenuPositionerContext is missing. MenuPositioner parts must be placed within <Menu.Positioner>.");
  }

  return context;
}
