import { createContext, useContext } from "reze-js";

import type { MenuRoot } from "../root/MenuRoot";

export interface MenuRadioGroupContext {
  value: any;
  setValue: (newValue: any, eventDetails: MenuRoot.ChangeEventDetails) => void;
  disabled: boolean;
}

export const MenuRadioGroupContext = createContext<MenuRadioGroupContext | undefined>(undefined);

export function useMenuRadioGroupContext(): MenuRadioGroupContext {
  const context = useContext(MenuRadioGroupContext);
  if (context === undefined) {
    throw new Error("Rebase UI: MenuRadioGroupContext is missing. MenuRadioGroup parts must be placed within <Menu.RadioGroup>.");
  }

  return context;
}
