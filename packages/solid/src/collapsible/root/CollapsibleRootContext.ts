import { createContext, useContext } from "../../internals/context";
import type { CollapsibleRoot } from "./CollapsibleRoot";
import type { CreateCollapsibleRootReturnValue } from "./createCollapsibleRoot";

export interface CollapsibleRootContext extends CreateCollapsibleRootReturnValue {
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  state: CollapsibleRoot.State;
}

export const CollapsibleRootContext = createContext<CollapsibleRootContext>();

export function useCollapsibleRootContext(): CollapsibleRootContext {
  const context = useContext(CollapsibleRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: CollapsibleRootContext is missing. Collapsible parts must be placed within <Collapsible.Root>.");
  }

  return context;
}
