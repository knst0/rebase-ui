import { createContext, useContext } from "reze-js";

export const NavigationMenuPortalContext = createContext<boolean | undefined>(undefined);

export function useNavigationMenuPortalContext(): boolean {
  const context = useContext(NavigationMenuPortalContext);
  if (context === undefined) {
    throw new Error("Rebase UI: <NavigationMenu.Portal> is missing.");
  }
  return context;
}
