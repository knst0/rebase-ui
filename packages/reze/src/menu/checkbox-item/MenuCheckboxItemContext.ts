import { createContext, useContext } from "reze-js";

export interface MenuCheckboxItemContext {
  checked: boolean;
  highlighted: boolean;
  disabled: boolean;
}

export const MenuCheckboxItemContext = createContext<MenuCheckboxItemContext | undefined>(undefined);

export function useMenuCheckboxItemContext(): MenuCheckboxItemContext {
  const context = useContext(MenuCheckboxItemContext);
  if (context === undefined) {
    throw new Error("Rebase UI: MenuCheckboxItemContext is missing. MenuCheckboxItem parts must be placed within <Menu.CheckboxItem>.");
  }

  return context;
}
