import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../internals/context";
import type { Orientation } from "../../internals/types";

export interface ToolbarRootContext {
  disabled: Accessor<boolean>;
  orientation: Accessor<Orientation>;
}

export const ToolbarRootContext = createContext<ToolbarRootContext>();

export function useToolbarRootContext(): ToolbarRootContext {
  const context = useContext(ToolbarRootContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ToolbarRootContext is missing. Toolbar parts must be placed within <Toolbar.Root>.");
  }

  return context;
}
