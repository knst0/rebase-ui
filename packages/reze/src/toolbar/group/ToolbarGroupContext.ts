import { createContext, useContext } from "reze-js";

export interface ToolbarGroupContext {
  disabled: () => boolean;
}

export const ToolbarGroupContext = createContext<ToolbarGroupContext | undefined>(undefined);

export function useToolbarGroupContext(): ToolbarGroupContext | undefined {
  return useContext(ToolbarGroupContext);
}
