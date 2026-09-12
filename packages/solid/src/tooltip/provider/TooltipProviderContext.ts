import { createContext, useContext } from "../../internals/context";

/**
 * Holds the provider's `delay` value. `closeDelay` is handled by the delay group.
 */
export const TooltipProviderContext = createContext<number | undefined>();

export function useTooltipProviderContext(): number | undefined {
  return useContext(TooltipProviderContext);
}
