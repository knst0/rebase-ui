import { createContext, useContext } from "../../internals/context";

export const PopoverPortalContext = createContext<boolean>();

export function usePopoverPortalContext(): boolean {
  const value = useContext(PopoverPortalContext);
  if (value === undefined) {
    throw new Error("Rebase UI: <Popover.Portal> is missing.");
  }
  return value;
}
