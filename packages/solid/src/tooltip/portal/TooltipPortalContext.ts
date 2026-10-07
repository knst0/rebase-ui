import { createContext, useContext } from "../../internals/context";

export const TooltipPortalContext = createContext<boolean>();

export function useTooltipPortalContext(): boolean {
  const value = useContext(TooltipPortalContext);
  if (value === undefined) {
    throw new Error("Rebase UI: <Tooltip.Portal> is missing.");
  }
  return value;
}
