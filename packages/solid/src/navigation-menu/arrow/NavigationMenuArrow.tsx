import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuPositionerContext } from "../positioner/NavigationMenuPositionerContext";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";
import { popupStateMapping } from "../utils/stateAttributesMapping";

/**
 * Displays an element pointing toward the navigation menu's current anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuArrow<T extends ValidComponent = "div">(props: NavigationMenuArrow.Props<T>) {
  const [local, elementProps] = split(props as NavigationMenuArrow.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const { open } = useNavigationMenuRootContext();
  const positioning = useNavigationMenuPositionerContext();

  const state: NavigationMenuArrowState = {
    get open() {
      return open();
    },
    get side() {
      return positioning.side();
    },
    get align() {
      return positioning.align();
    },
    get uncentered() {
      return positioning.arrowUncentered();
    },
  };

  const arrowProps = {
    "aria-hidden": "true" as const,
    get style() {
      return positioning.arrowStyles();
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<Element>(externalProps.ref, (element: Element | null) => {
      positioning.arrowRef.current = element;
    }),
  });

  return <RenderElement as={as} state={state} props={[arrowProps, elementProps, refProps]} stateAttributesMapping={popupStateMapping} />;
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<NavigationMenuArrow.Props>);

export interface NavigationMenuArrowState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The side of the anchor the popup is positioned on.
   */
  side: Side;
  /**
   * The alignment of the popup relative to the anchor.
   */
  align: Align;
  /**
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export type NavigationMenuArrowProps<T extends ValidComponent = "div"> = RebaseUIComponentProps<T, NavigationMenuArrowState>;

export namespace NavigationMenuArrow {
  export type State = NavigationMenuArrowState;
  export type Props<T extends ValidComponent = "div"> = NavigationMenuArrowProps<T>;
}
