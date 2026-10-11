import { createContext, useContext } from "reze-js";

export const PopoverPortalContext = createContext<boolean | undefined>(undefined);

export function usePopoverPortalContext(): boolean {
  const value = useContext(PopoverPortalContext);
  if (value === undefined) {
    throw new Error("Rebase UI: <Popover.Portal> is missing.");
  }
  return value;
}
