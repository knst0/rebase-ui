import { createContext, useContext } from "reze-js";

export interface SelectItemContext {
  selected: () => boolean;
  index: () => number;
  textRef: { current: HTMLElement | null };
  selectedByFocus: () => boolean;
}

export const SelectItemContext = createContext<SelectItemContext | undefined>(undefined);

export function useSelectItemContext(): SelectItemContext {
  const context = useContext(SelectItemContext);
  if (context === undefined) {
    throw new Error("Rebase UI: SelectItemContext is missing. SelectItem parts must be placed within <Select.Item>.");
  }
  return context;
}
