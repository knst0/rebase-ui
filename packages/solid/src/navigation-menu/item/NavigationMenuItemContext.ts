import { createContext, useContext } from "../../internals/context";

export interface NavigationMenuItemContext {
  value: () => any;
}

export const NavigationMenuItemContext = createContext<NavigationMenuItemContext>();

export function useNavigationMenuItemContext(): NavigationMenuItemContext {
  const context = useContext(NavigationMenuItemContext);
  if (context === undefined) {
    throw new Error(
      "Rebase UI: NavigationMenuItemContext is missing. Navigation Menu Item parts must be placed within <NavigationMenu.Item>.",
    );
  }
  return context;
}
