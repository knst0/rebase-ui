import { createContext, useContext } from "reze-js";

export const TooltipPortalContext = createContext<boolean | undefined>(undefined);

export function useTooltipPortalContext(): boolean {
  const value = useContext(TooltipPortalContext);
  if (value === undefined) {
    throw new Error("Rebase UI: <Tooltip.Portal> is missing.");
  }
  return value;
}
