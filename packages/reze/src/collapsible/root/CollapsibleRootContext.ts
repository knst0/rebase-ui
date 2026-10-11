import { createContext, useContext } from "reze-js";

import type { TransitionStatus } from "../../internals/transition-status";
import type { CollapsibleRoot } from "./CollapsibleRoot";
import type { CreateCollapsibleRootReturnValue } from "./createCollapsibleRoot";

export interface CollapsibleRootContext extends CreateCollapsibleRootReturnValue {
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  state: {
    open: () => boolean;
    disabled: () => boolean;
    transitionStatus: () => TransitionStatus;
  };
}

export const CollapsibleRootContext = createContext<CollapsibleRootContext | undefined>(undefined);

export function useCollapsibleRootContext(): CollapsibleRootContext {
  const context = useContext(CollapsibleRootContext);

  if (context === undefined) {
    throw new Error("Rebase UI: CollapsibleRootContext is missing. Collapsible parts must be placed within <Collapsible.Root>.");
  }

  return context;
}
