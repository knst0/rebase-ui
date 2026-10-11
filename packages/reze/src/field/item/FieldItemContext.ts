import { createContext, useContext } from "reze-js";

export interface FieldItemContext {
  disabled: () => boolean;
}

export const FieldItemContext = createContext<FieldItemContext>({ disabled: () => false });

export function useFieldItemContext(): FieldItemContext {
  return useContext(FieldItemContext);
}
