import { createContext, useContext } from "../../internals/context";

export const MenuPortalContext = createContext<boolean>();

export function useMenuPortalContext(): boolean {
  const value = useContext(MenuPortalContext);
  if (value === undefined) {
    throw new Error("Rebase UI: <Menu.Portal> is missing.");
  }
  return value;
}
