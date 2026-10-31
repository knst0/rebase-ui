import type { Padding, VirtualElement } from "@floating-ui/dom";
import { dynamicElement, omitProps, onCleanup, store as createStore, untrack, type JSX } from "reze-js";

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
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useNavigationMenuPortalContext } from "../portal/NavigationMenuPortalContext";
import { useNavigationMenuRootContext, useNavigationMenuTreeContext } from "../root/NavigationMenuRootContext";
import { inPlace } from "../utils/inPlace";
import { ResolvedChildren } from "../utils/ResolvedChildren";
import { watch } from "../utils/watch";
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
export function NavigationMenuPositioner<T extends JSX.ElementType = "div">(props: NavigationMenuPositioner.Props<T>) {
  const rest = omitProps(
    props,
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
    "class",
    "style",
    "children",
    "ref",
  );

  const { open, mounted, positionerElement, setPositionerElement, activeTrigger, nested, transitionStatus } =
    useNavigationMenuRootContext();
  const keepMounted = useNavigationMenuPortalContext();
  const nodeId = useNavigationMenuTreeContext();

  // When the menu is initially open, disable the positioner's transition for one frame
  // so a default value does not animate in from the unpositioned portal state.
  const local = createStore({ instant: untrack(open) });
  const instant = () => local.instant;
  const setInstant = (value: boolean) => {
    local.instant = value;
  };
  let needsInitialInstantReset = untrack(open);

  watch(positionerElement, (positioner) => {
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
  const floatingRootContext = useFloatingRootContext({ open });

  const positioning = createAnchorPositioning({
    get anchor() {
      return props.anchor ?? activeTrigger();
    },
    positionMethod: props.positionMethod ?? "absolute",
    mounted,
    side: props.side ?? "bottom",
    get sideOffset() {
      return props.sideOffset;
    },
    align: props.align ?? "center",
    get alignOffset() {
      return props.alignOffset;
    },
    arrowPadding: props.arrowPadding ?? 5,
    collisionBoundary: props.collisionBoundary ?? "clipping-ancestors",
    collisionPadding: props.collisionPadding ?? 5,
    sticky: props.sticky ?? false,
    disableAnchorTracking: props.disableAnchorTracking ?? false,
    keepMounted,
    floatingRootContext,
    collisionAvoidance: props.collisionAvoidance ?? (nested ? POPUP_COLLISION_AVOIDANCE : DROPDOWN_COLLISION_AVOIDANCE),
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

  watch(open, (isOpen) => {
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

  function snapshot(): NavigationMenuPositionerState {
    return {
      open: open(),
      side: positioning.side(),
      align: positioning.align(),
      anchorHidden: positioning.anchorHidden(),
      instant: instant(),
    };
  }

  const contextValue: NavigationMenuPositionerContext = {
    side: positioning.side,
    align: positioning.align,
    physicalSide: positioning.physicalSide,
    anchorHidden: positioning.anchorHidden,
    arrowRef: positioning.arrowRef,
    arrowUncentered: positioning.arrowUncentered,
    arrowStyles: positioning.arrowStyles,
  };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement.
  return inPlace(
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
      hidden={!mounted() || undefined}
      inert={!open() || undefined}
      data-open={open() ? "" : undefined}
      data-closed={open() ? undefined : ""}
      data-side={positioning.side()}
      data-align={positioning.align()}
      data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
      data-instant={instant() ? "" : undefined}
      class={resolveClassValue(props.class as never, snapshot())}
      style={mergeStyleValue(
        {
          ...positioning.positionerStyles(),
          ...(transitionStatus() === "starting" ? { transition: "none" } : null),
        } as Record<string, string | undefined>,
        resolveStyleValue(props.style as never, snapshot()),
      )}
      ref={mergeRefs(
        (element: HTMLElement | null) => {
          positioning.refs.setFloating(element);
          setPositionerElement(element);
        },
        props.ref as ((element: HTMLElement | null) => void) | undefined,
      )}
    >
      <NavigationMenuPositionerContext value={contextValue}>
        <ResolvedChildren snapshot={snapshot}>{props.children}</ResolvedChildren>
      </NavigationMenuPositionerContext>
    </Tag>,
  );
}

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

export type NavigationMenuPositionerProps<T extends JSX.ElementType = "div"> = NavigationMenuPositionerOwnProps &
  RebaseUIComponentProps<T, NavigationMenuPositionerState>;

export namespace NavigationMenuPositioner {
  export type State = NavigationMenuPositionerState;
  export type Props<T extends JSX.ElementType = "div"> = NavigationMenuPositionerProps<T>;
}
