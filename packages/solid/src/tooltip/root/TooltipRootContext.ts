import { createContext, useContext } from "../../internals/context";
import type { TooltipStore } from "../store/TooltipStore";

export type TooltipRootContext<Payload = unknown> = TooltipStore<Payload>;

export const TooltipRootContext = createContext<TooltipRootContext<any>>();

export function useTooltipRootContext(optional?: false): TooltipRootContext;
export function useTooltipRootContext(optional: true): TooltipRootContext | undefined;
export function useTooltipRootContext(optional?: boolean): TooltipRootContext | undefined {
  const context = useContext(TooltipRootContext);

  if (context === undefined && !optional) {
    throw new Error("Rebase UI: TooltipRootContext is missing. Tooltip parts must be placed within <Tooltip.Root>.");
  }

  return context;
}
