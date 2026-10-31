import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuItemContext } from "../item/NavigationMenuItemContext";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";
import { triggerOpenStateMapping } from "../utils/stateAttributesMapping";

const ICON_PROPS = { "aria-hidden": "true" as const, children: "▼" };

/**
 * An icon that indicates that the trigger button opens a menu.
 * Renders a `<span>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuIcon<T extends ValidComponent = "span">(props: NavigationMenuIcon.Props<T>) {
  const [local, elementProps] = split(props as NavigationMenuIcon.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const item = useNavigationMenuItemContext();
  const { open, value } = useNavigationMenuRootContext();

  const state: NavigationMenuIconState = {
    get open() {
      return open() && value() === item.value();
    },
  };

  return <RenderElement as={as} state={state} props={[ICON_PROPS, elementProps]} stateAttributesMapping={triggerOpenStateMapping} />;
}

const defaultProps = Object.freeze({
  as: "span",
} satisfies Partial<NavigationMenuIcon.Props>);

export interface NavigationMenuIconState {
  /**
   * Whether the navigation menu is open and the item is active.
   */
  open: boolean;
}

export type NavigationMenuIconProps<T extends ValidComponent = "span"> = RebaseUIComponentProps<T, NavigationMenuIconState>;

export namespace NavigationMenuIcon {
  export type State = NavigationMenuIconState;
  export type Props<T extends ValidComponent = "span"> = NavigationMenuIconProps<T>;
}
