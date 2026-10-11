import { createContext, useContext } from "reze-js";

export interface MenuRadioItemContext {
  checked: boolean;
  highlighted: boolean;
  disabled: boolean;
}

export const MenuRadioItemContext = createContext<MenuRadioItemContext | undefined>(undefined);

export function useMenuRadioItemContext(): MenuRadioItemContext {
  const context = useContext(MenuRadioItemContext);
  if (context === undefined) {
    throw new Error("Rebase UI: MenuRadioItemContext is missing. MenuRadioItem parts must be placed within <Menu.RadioItem>.");
  }

  return context;
}
