import { createContext, useContext } from "reze-js";

export interface ComboboxItemContext {
  selected: () => boolean;
  textRef: { current: HTMLElement | null };
}

export const ComboboxItemContext = createContext<ComboboxItemContext | undefined>(undefined);

export function useComboboxItemContext(): ComboboxItemContext {
  const context = useContext(ComboboxItemContext);
  if (context === undefined) {
    throw new Error("Rebase UI: ComboboxItemContext is missing. ComboboxItem parts must be placed within <Combobox.Item>.");
  }
  return context;
}
