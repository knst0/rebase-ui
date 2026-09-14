import { createContext, useContext } from "../../internals/context";

export interface MenuCheckboxItemContext {
  checked: boolean;
  highlighted: boolean;
  disabled: boolean;
}

export const MenuCheckboxItemContext = createContext<MenuCheckboxItemContext>();

export function useMenuCheckboxItemContext(): MenuCheckboxItemContext {
  const context = useContext(MenuCheckboxItemContext);
  if (context === undefined) {
    throw new Error("Rebase UI: MenuCheckboxItemContext is missing. MenuCheckboxItem parts must be placed within <Menu.CheckboxItem>.");
  }

  return context;
}
