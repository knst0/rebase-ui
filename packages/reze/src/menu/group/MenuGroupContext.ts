import { createContext, useContext } from "reze-js";

export interface MenuGroupContext {
  labelId: () => string | undefined;
  setLabelId: (id: string | undefined) => void;
}

export const MenuGroupContext = createContext<MenuGroupContext | undefined>(undefined);

export function useMenuGroupRootContext(): MenuGroupContext {
  const context = useContext(MenuGroupContext);
  if (context === undefined) {
    throw new Error("Rebase UI: MenuGroupContext is missing. Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.");
  }

  return context;
}
