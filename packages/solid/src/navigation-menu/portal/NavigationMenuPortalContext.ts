import { createContext, useContext } from "../../internals/context";

export const NavigationMenuPortalContext = createContext<boolean>();

export function useNavigationMenuPortalContext(): boolean {
  const context = useContext(NavigationMenuPortalContext);
  if (context === undefined) {
    throw new Error("Rebase UI: <NavigationMenu.Portal> is missing.");
  }
  return context;
}
