import type { Padding, VirtualElement } from "@floating-ui/dom";
import { dynamicElement, getOwner, omitProps, runWithOwner, untrack, type JSX } from "reze-js";

import {
  createAnchorPositioning,
  POPUP_COLLISION_AVOIDANCE,
  type Align,
  type Boundary,
  type CollisionAvoidance,
  type OffsetFunction,
  type Side,
} from "../../internals/anchor-positioning/createAnchorPositioning";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { useTooltipPortalContext } from "../portal/TooltipPortalContext";
import { useTooltipRootContext } from "../root/TooltipRootContext";
import { TooltipPositionerContext } from "./TooltipPositionerContext";

/**
 * Positions the tooltip against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Tooltip](https://rebase-ui.knst.dev/components/tooltip)
 */
export function TooltipPositioner<T extends JSX.ElementType = "div">(props: TooltipPositioner.Props<T>) {
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
  // Deliberately not hoisted: positioner children must be created inside the positioner
  // context provider (and the Content branch) below, not in this body.

  const store = useTooltipRootContext();
  const keepMounted = useTooltipPortalContext();

  const positioning = createAnchorPositioning({
    get anchor() {
      return props.anchor;
    },
    positionMethod: props.positionMethod ?? "absolute",
    side: props.side ?? "top",
    align: props.align ?? "center",
    get sideOffset() {
      return props.sideOffset;
    },
    get alignOffset() {
      return props.alignOffset;
    },
    collisionBoundary: props.collisionBoundary ?? "clipping-ancestors",
    collisionPadding: props.collisionPadding ?? 5,
    sticky: props.sticky ?? false,
    arrowPadding: props.arrowPadding ?? 5,
    disableAnchorTracking: props.disableAnchorTracking ?? false,
    keepMounted,
    floatingRootContext: untrack(() => store.select("floatingRootContext")),
    mounted: () => store.select("mounted") as boolean,
    collisionAvoidance: props.collisionAvoidance ?? POPUP_COLLISION_AVOIDANCE,
    get adaptiveOrigin() {
      return store.select("adaptiveOrigin");
    },
  });

  const contextValue: TooltipPositionerContext = {
    side: positioning.side,
    align: positioning.align,
    arrowRef: positioning.arrowRef,
    arrowUncentered: positioning.arrowUncentered,
    arrowStyles: positioning.arrowStyles,
  };

  function snapshot(): TooltipPositionerState {
    return {
      open: store.select("open") as boolean,
      side: positioning.side(),
      align: positioning.align(),
      anchorHidden: positioning.anchorHidden(),
      instant:
        (store.select("trackCursorAxis") as string) !== "none"
          ? "tracking-cursor"
          : (store.select("instantType") as TooltipPositionerState["instant"]),
    };
  }

  function internalStyle(): Record<string, string | undefined> {
    const styles = { ...(positioning.positionerStyles() as Record<string, string | undefined>) };
    const isOpen = store.select("open") as boolean;
    const trackCursorAxis = store.select("trackCursorAxis") as string;
    const disableHoverablePopup = store.select("disableHoverablePopup") as boolean;
    if (!isOpen || trackCursorAxis === "both" || disableHoverablePopup) {
      styles["pointer-events"] = "none";
    }
    if ((store.select("transitionStatus") as string | undefined) === "starting") {
      styles.transition = "none";
    }
    return styles;
  }

  function open(): boolean {
    return store.select("open") as boolean;
  }

  function mounted(): boolean {
    return store.select("mounted") as boolean;
  }

  function instant(): string | undefined {
    return snapshot().instant ?? undefined;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function positionerRef(element: HTMLElement | null): void {
    positioning.refs.setFloating(element);
    store.set("positionerElement", element);
  }

  const elementRef = mergeRefs(positionerRef, props.ref as ((element: HTMLElement | null) => void) | undefined);

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the positioner parts without context. Children
  // resolve in TooltipPositionerContent below so they are created inside the provider.
  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would restart the
  // positioning transition. The default path renders a static `<div>`; only a customized
  // `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="presentation"
        hidden={!mounted() || undefined}
        data-open={open() ? "" : undefined}
        data-closed={open() ? undefined : ""}
        data-side={positioning.side()}
        data-align={positioning.align()}
        data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
        data-instant={instant()}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue(internalStyle(), resolveStyleValue(props.style, snapshot()))}
        ref={elementRef}
      >
        <TooltipPositionerContext value={contextValue}>
          <TooltipPositionerContent snapshot={snapshot}>{props.children}</TooltipPositionerContent>
        </TooltipPositionerContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
      hidden={!mounted() || undefined}
      data-open={open() ? "" : undefined}
      data-closed={open() ? undefined : ""}
      data-side={positioning.side()}
      data-align={positioning.align()}
      data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
      data-instant={instant()}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(internalStyle(), resolveStyleValue(props.style, snapshot()))}
      ref={elementRef}
    >
      <TooltipPositionerContext value={contextValue}>
        <TooltipPositionerContent snapshot={snapshot}>{props.children}</TooltipPositionerContent>
      </TooltipPositionerContext>
    </Tag>
  );
}

/**
 * Resolves the positioner children inside the positioner context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the positioning state changes.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function TooltipPositionerContent(props: {
  children: ChildrenValue<TooltipPositionerState>;
  snapshot: () => TooltipPositionerState;
}) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: TooltipPositionerState) => JSX.Element;
    const snapshot = props.snapshot;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the positioner context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const state = snapshot();

      return runWithOwner(owner, () => render(state));
    };
  }

  return children as JSX.Element;
}

export interface TooltipPositionerState {
  /**
   * Whether the tooltip is currently open.
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
  instant: string | undefined;
}

export interface TooltipPositionerOwnProps {
  /**
   * An element to position the popup against.
   * By default, the popup will be positioned against the trigger.
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
   * @default 'top'
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
   * Use it to prevent the arrow element from hanging out of the rounded corners of a popup.
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

export type TooltipPositionerProps<T extends JSX.ElementType = "div"> = TooltipPositionerOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, TooltipPositionerState>;

export namespace TooltipPositioner {
  export type State = TooltipPositionerState;
  export type Props<T extends JSX.ElementType = "div"> = TooltipPositionerProps<T>;
}
