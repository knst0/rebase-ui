import { createContext, useContext } from "reze-js";

import type { Orientation } from "../../internals/types";

export interface ToolbarRootContext {
  disabled: () => boolean;
  orientation: () => Orientation;
}

export const ToolbarRootContext = createContext<ToolbarRootContext | undefined>(undefined);

export function useToolbarRootContext(): ToolbarRootContext {
  const context = useContext(ToolbarRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ToolbarRootContext is missing. Toolbar parts must be placed within <Toolbar.Root>.");
  }

  return context;
}
