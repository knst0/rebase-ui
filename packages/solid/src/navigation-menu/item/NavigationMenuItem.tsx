import type { ValidComponent } from "@solidjs/web";
import { createUniqueId, untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { NavigationMenuItemContext } from "./NavigationMenuItemContext";

/**
 * An individual navigation menu item.
 * Renders a `<li>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuItem<T extends ValidComponent = "li">(props: NavigationMenuItem.Props<T>) {
  const [local, elementProps] = split(props as NavigationMenuItem.Props, { default: defaultProps }, ["as", "value"]);

  const as = untrack(() => local.as);
  const id = createUniqueId();

  return (
    <NavigationMenuItemContext value={{ value: () => local.value ?? id }}>
      <RenderElement as={as} props={[elementProps]} untrackChildren />
    </NavigationMenuItemContext>
  );
}

const defaultProps = Object.freeze({
  as: "li",
} satisfies Partial<NavigationMenuItem.Props>);

export interface NavigationMenuItemState {}

export interface NavigationMenuItemOwnProps {
  /**
   * A unique value that identifies this navigation menu item.
   * If no value is provided, a unique ID will be generated automatically.
   * Use when controlling the navigation menu programmatically.
   */
  value?: any;
}

export type NavigationMenuItemProps<T extends ValidComponent = "li"> = NavigationMenuItemOwnProps &
  Omit<RebaseUIComponentProps<T, NavigationMenuItemState>, "value">;

export namespace NavigationMenuItem {
  export type State = NavigationMenuItemState;
  export type Props<T extends ValidComponent = "li"> = NavigationMenuItemProps<T>;
}
