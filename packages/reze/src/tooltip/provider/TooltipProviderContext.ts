import { createContext, useContext } from "reze-js";

/**
 * Holds the provider's `delay` value. `closeDelay` is handled by the delay group.
 */
export const TooltipProviderContext = createContext<number | undefined>(undefined);

export function useTooltipProviderContext(): number | undefined {
  return useContext(TooltipProviderContext);
}
