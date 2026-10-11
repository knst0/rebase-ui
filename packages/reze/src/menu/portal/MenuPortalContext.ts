import { createContext, useContext } from "reze-js";

export const MenuPortalContext = createContext<boolean | undefined>(undefined);

export function useMenuPortalContext(): boolean {
  const value = useContext(MenuPortalContext);
  if (value === undefined) {
    throw new Error("Rebase UI: <Menu.Portal> is missing.");
  }
  return value;
}
