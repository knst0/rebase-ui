import type { JSX, ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";
import { popupTransitionStateMapping } from "../utils/stateAttributesMapping";

/**
 * A backdrop for the navigation menu popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuBackdrop<T extends ValidComponent = "div">(props: NavigationMenuBackdrop.Props<T>) {
  const [local, elementProps] = split(props as NavigationMenuBackdrop.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { open, mounted, transitionStatus } = useNavigationMenuRootContext();

  const state: NavigationMenuBackdropState = {
    get open() {
      return open();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const backdropProps = {
    role: "presentation" as const,
    get hidden() {
      return !mounted() || undefined;
    },
    style: { "user-select": "none", "-webkit-user-select": "none" } as JSX.CSSProperties,
  };

  return <RenderElement as={as} state={state} props={[backdropProps, elementProps]} stateAttributesMapping={popupTransitionStateMapping} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<NavigationMenuBackdrop.Props>);

export interface NavigationMenuBackdropState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The transition status of the popup.
   */
  transitionStatus: TransitionStatus;
}

export type NavigationMenuBackdropProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, NavigationMenuBackdropState>;

export namespace NavigationMenuBackdrop {
  export type State = NavigationMenuBackdropState;
  export type Props<T extends ValidComponent = "div"> = NavigationMenuBackdropProps<T>;
}
