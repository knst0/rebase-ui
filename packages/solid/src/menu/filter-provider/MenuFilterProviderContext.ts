import type { JSX } from "@solidjs/web";

import { createContext, useContext } from "../../internals/context";
import type { MenuFilterRoot } from "../filter-root/MenuFilterRoot";
import type { MenuFilterSubmenuRoot } from "../filter-submenu-root/MenuFilterSubmenuRoot";
import type { MenuFilterProviderOptions } from "./MenuFilterProviderOptions";

/**
 * What `Menu.FilterProvider` hands to the root directly inside it: the filterable root
 * implementations (the provider is their only importer) and the filter props.
 */
export interface MenuFilterProviderContext {
  Root: (props: MenuFilterRoot.Props) => JSX.Element;
  SubmenuRoot: (props: MenuFilterSubmenuRoot.Props) => JSX.Element;
  // The provider's own props object, `children` included; consumers omit it (not read it).
  options: MenuFilterProviderOptions & { children?: JSX.Element };
}

/**
 * Non-null only directly below a provider. The root that consumes it resets it, so a plain
 * `Menu.SubmenuRoot` inside a filterable menu stays plain.
 */
export const MenuFilterProviderContext = createContext<MenuFilterProviderContext | null>();

export function useMenuFilterProviderContext() {
  return useContext(MenuFilterProviderContext) ?? null;
}
