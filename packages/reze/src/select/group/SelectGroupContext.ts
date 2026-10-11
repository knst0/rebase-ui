import { createContext, useContext } from "reze-js";

export interface SelectGroupContext {
  labelId: string | undefined;
  setLabelId: (next: string | undefined | ((prev: string | undefined) => string | undefined)) => void;
}

export const SelectGroupContext = createContext<SelectGroupContext | undefined>(undefined);

export function useSelectGroupContext(): SelectGroupContext {
  const context = useContext(SelectGroupContext);
  if (context === undefined) {
    throw new Error("Rebase UI: SelectGroupContext is missing. SelectGroup parts must be placed within <Select.Group>.");
  }
  return context;
}
