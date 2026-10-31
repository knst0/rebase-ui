import type { JSX, ValidComponent } from "@solidjs/web";
import { createUniqueId, untrack } from "solid-js";

import type { Align, Side } from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuPositionerContext } from "../positioner/NavigationMenuPositionerContext";
import { useNavigationMenuRootContext } from "../root/NavigationMenuRootContext";
import { popupTransitionStateMapping } from "../utils/stateAttributesMapping";

/**
 * A container for the navigation menu contents.
 * Renders a `<nav>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuPopup<T extends ValidComponent = "nav">(props: NavigationMenuPopup.Props<T>) {
  const [local, elementProps] = split(props as NavigationMenuPopup.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);
  const generatedId = createUniqueId();

  const { open, transitionStatus, setPopupElement } = useNavigationMenuRootContext();
  const positioning = useNavigationMenuPositionerContext();

  const state: NavigationMenuPopupState = {
    get open() {
      return open();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get side() {
      return positioning.side();
    },
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
  };

  const popupProps = {
    id: generatedId,
    tabindex: -1,
    // Ensure popup size transitions correctly when anchored to `bottom` (side=top) or `right` (side=left).
    get style(): JSX.CSSProperties {
      const physicalSide = positioning.physicalSide();
      const isPhysicalLeft = physicalSide === "left";
      const originStyle: JSX.CSSProperties =
        physicalSide === "top" || isPhysicalLeft
          ? {
              position: "absolute",
              [physicalSide === "top" ? "bottom" : "top"]: "0px",
              [isPhysicalLeft ? "right" : "left"]: "0px",
            }
          : {};
      return { ...originStyle, ...(transitionStatus() === "starting" ? { transition: "none" } : undefined) };
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, setPopupElement),
  });

  return (
    <RenderElement
      as={as}
      state={state}
      props={[popupProps, elementProps, refProps]}
      stateAttributesMapping={popupTransitionStateMapping}
      untrackChildren
    />
  );
}

const defaultProps = Object.freeze({
  as: "nav",
} satisfies Partial<NavigationMenuPopup.Props>);

export interface NavigationMenuPopupState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The transition status of the popup.
   */
  transitionStatus: TransitionStatus;
  /**
   * The side of the anchor the popup is positioned on.
   */
  side: Side;
  /**
   * The alignment of the popup relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export type NavigationMenuPopupProps<T extends ValidComponent = "nav"> = RebaseUIComponentProps<T, NavigationMenuPopupState>;

export namespace NavigationMenuPopup {
  export type State = NavigationMenuPopupState;
  export type Props<T extends ValidComponent = "nav"> = NavigationMenuPopupProps<T>;
}
