import type { Accessor } from "solid-js";

import { createContext, useContext } from "../../internals/context";

export interface ToolbarGroupContext {
  disabled: Accessor<boolean>;
}

export const ToolbarGroupContext = createContext<ToolbarGroupContext>();

export function useToolbarGroupContext(): ToolbarGroupContext | undefined {
  return useContext(ToolbarGroupContext);
}
