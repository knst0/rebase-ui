import type { Padding, VirtualElement } from "@floating-ui/dom";
import type { JSX, ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, flush, onCleanup, untrack } from "solid-js";

import { adaptiveOrigin } from "../../internals/anchor-positioning/adaptiveOrigin";
import {
  createAnchorPositioning,
  POPUP_COLLISION_AVOIDANCE,
  type Align,
  type Boundary,
  type CollisionAvoidance,
  type OffsetFunction,
  type Side,
} from "../../internals/anchor-positioning/createAnchorPositioning";
import { useFloatingRootContext } from "../../internals/floating/useFloatingRootContext";
import { disableFocusInside, enableFocusInside, isOutsideEvent } from "../../internals/floating/utils/tabbable";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuPortalContext } from "../portal/NavigationMenuPortalContext";
import { useNavigationMenuRootContext, useNavigationMenuTreeContext } from "../root/NavigationMenuRootContext";
import { popupStateMapping } from "../utils/stateAttributesMapping";
import { NavigationMenuPositionerContext } from "./NavigationMenuPositionerContext";

const DROPDOWN_COLLISION_AVOIDANCE = {
  fallbackAxisSide: "none",
} as const;

/**
 * Positions the navigation menu against the currently active trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuPositioner<T extends ValidComponent = "div">(props: NavigationMenuPositioner.Props<T>) {
  const [local, elementProps] = split(props as NavigationMenuPositioner.Props, { default: defaultProps }, [
    "as",
    "anchor",
    "positionMethod",
    "side",
    "align",
    "sideOffset",
    "alignOffset",
    "collisionBoundary",
    "collisionPadding",
    "arrowPadding",
    "sticky",
    "disableAnchorTracking",
    "collisionAvoidance",
  ]);

  const as = untrack(() => local.as);

  const { open, mounted, positionerElement, setPositionerElement, activeTrigger, nested, transitionStatus } =
    useNavigationMenuRootContext();
  const keepMounted = useNavigationMenuPortalContext();
  const nodeId = useNavigationMenuTreeContext();

  // When the menu is initially open, disable the positioner's transition for one frame
  // so a default value does not animate in from the unpositioned portal state.
  const [instant, setInstant] = createSignal(untrack(open), { ownedWrite: true });
  let needsInitialInstantReset = untrack(open);

  createEffect(positionerElement, (positioner) => {
    if (!positioner) {
      return undefined;
    }

    // Make sure elements inside the portal element are tabbable only when the
    // portal has already been focused, either by tabbing into a focus trap
    // element outside or using the mouse.
    function onFocus(event: FocusEvent) {
      if (isOutsideEvent(event)) {
        const manageFocus = event.type === "focusin" ? enableFocusInside : disableFocusInside;
        manageFocus(positioner as HTMLElement);
      }
    }

    // Listen to the event on the capture phase so they run before the focus
    // trap elements onFocus prop is called.
    positioner.addEventListener("focusin", onFocus, true);
    positioner.addEventListener("focusout", onFocus, true);

    return () => {
      positioner.removeEventListener("focusin", onFocus, true);
      positioner.removeEventListener("focusout", onFocus, true);
    };
  });

  // Triggers own the interaction stores, so positioning runs on its own store and
  // follows the active trigger through `anchor`.
  const floatingRootContext = untrack(() => useFloatingRootContext({ open }));

  const positioning = createAnchorPositioning({
    get anchor() {
      return local.anchor ?? activeTrigger();
    },
    positionMethod: untrack(() => local.positionMethod),
    mounted,
    side: untrack(() => local.side),
    get sideOffset() {
      return local.sideOffset;
    },
    align: untrack(() => local.align),
    get alignOffset() {
      return local.alignOffset;
    },
    arrowPadding: untrack(() => local.arrowPadding),
    collisionBoundary: untrack(() => local.collisionBoundary),
    collisionPadding: untrack(() => local.collisionPadding),
    sticky: untrack(() => local.sticky),
    disableAnchorTracking: untrack(() => local.disableAnchorTracking) as boolean,
    keepMounted,
    floatingRootContext,
    collisionAvoidance: untrack(() => local.collisionAvoidance) ?? (nested ? POPUP_COLLISION_AVOIDANCE : DROPDOWN_COLLISION_AVOIDANCE),
    shift: { rootBoundary: "layoutViewport" },
    nodeId,
    // Allows the menu to remain anchored without wobbling while its size
    // and position transition simultaneously when side=top or side=left.
    adaptiveOrigin,
  } as Parameters<typeof createAnchorPositioning>[0]);

  let initialInstantTimeout: ReturnType<typeof setTimeout> | undefined;
  let resizeTimeout: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    clearTimeout(initialInstantTimeout);
    clearTimeout(resizeTimeout);
  });

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      return undefined;
    }

    if (needsInitialInstantReset) {
      initialInstantTimeout = setTimeout(() => {
        needsInitialInstantReset = false;

        if (resizeTimeout === undefined) {
          setInstant(false);
        }
      }, 0);
    }

    function handleResize() {
      setInstant(true);
      flush();

      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        resizeTimeout = undefined;
        setInstant(false);
      }, 100);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });

  const state: NavigationMenuPositionerState = {
    get open() {
      return open();
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
    get instant() {
      return instant();
    },
  };

  const positionerProps = {
    role: "presentation" as const,
    get hidden() {
      return !mounted() || undefined;
    },
    get inert() {
      return !open() || undefined;
    },
    get style(): JSX.CSSProperties {
      return { ...positioning.positionerStyles(), ...(transitionStatus() === "starting" ? { transition: "none" } : undefined) };
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, (element: HTMLElement | null) => {
      positioning.refs.setFloating(element);
      setPositionerElement(element);
    }),
  });

  return (
    <NavigationMenuPositionerContext
      value={{
        side: positioning.side,
        align: positioning.align,
        physicalSide: positioning.physicalSide,
        anchorHidden: positioning.anchorHidden,
        arrowRef: positioning.arrowRef,
        arrowUncentered: positioning.arrowUncentered,
        arrowStyles: positioning.arrowStyles,
      }}
    >
      <RenderElement
        as={as}
        state={state}
        props={[positionerProps, elementProps, refProps]}
        stateAttributesMapping={popupStateMapping}
        untrackChildren
      />
    </NavigationMenuPositionerContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  positionMethod: "absolute",
  side: "bottom",
  align: "center",
  sideOffset: 0,
  alignOffset: 0,
  collisionBoundary: "clipping-ancestors",
  collisionPadding: 5,
  arrowPadding: 5,
  sticky: false,
  disableAnchorTracking: false,
} satisfies Partial<NavigationMenuPositioner.Props>);

export interface NavigationMenuPositionerState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: boolean;
}

export interface NavigationMenuPositionerOwnProps {
  /**
   * An element to position the popup against.
   * By default, the popup will be positioned against the active trigger.
   */
  anchor?: Element | VirtualElement | null | { current: Element | null } | (() => Element | VirtualElement | null) | undefined;
  /**
   * Determines which CSS `position` property to use.
   * @default 'absolute'
   */
  positionMethod?: "absolute" | "fixed" | undefined;
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   * @default 'bottom'
   */
  side?: Side | undefined;
  /**
   * Distance between the anchor and the popup in pixels.
   * Also accepts a function that returns the distance.
   * @default 0
   */
  sideOffset?: number | OffsetFunction | undefined;
  /**
   * How to align the popup relative to the specified side.
   * @default 'center'
   */
  align?: Align | undefined;
  /**
   * Additional offset along the alignment axis in pixels.
   * Also accepts a function that returns the offset.
   * @default 0
   */
  alignOffset?: number | OffsetFunction | undefined;
  /**
   * An element or a rectangle that delimits the area that the popup is confined to.
   * @default 'clipping-ancestors'
   */
  collisionBoundary?: Boundary | undefined;
  /**
   * Additional space to maintain from the edge of the collision boundary.
   * @default 5
   */
  collisionPadding?: Padding | undefined;
  /**
   * Whether to maintain the popup in the viewport after
   * the anchor element was scrolled out of view.
   * @default false
   */
  sticky?: boolean | undefined;
  /**
   * Minimum distance to maintain between the arrow and the edges of the popup.
   * @default 5
   */
  arrowPadding?: number | undefined;
  /**
   * Whether to disable the popup from tracking any layout shift of its positioning anchor.
   * @default false
   */
  disableAnchorTracking?: boolean | undefined;
  /**
   * Determines how to handle collisions when positioning the popup.
   */
  collisionAvoidance?: CollisionAvoidance | undefined;
}

export type NavigationMenuPositionerProps<T extends ValidComponent = "div"> = NavigationMenuPositionerOwnProps &
  RebaseUIComponentProps<T, NavigationMenuPositionerState>;

export namespace NavigationMenuPositioner {
  export type State = NavigationMenuPositionerState;
  export type Props<T extends ValidComponent = "div"> = NavigationMenuPositionerProps<T>;
}
