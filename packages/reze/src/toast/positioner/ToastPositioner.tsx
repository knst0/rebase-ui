import type { Padding, VirtualElement } from "@floating-ui/dom";
import { isElement } from "@floating-ui/utils/dom";
import { dynamicElement, getOwner, omitProps, runWithOwner, type JSX } from "reze-js";

import {
  createAnchorPositioning,
  POPUP_COLLISION_AVOIDANCE,
  type Align,
  type Boundary,
  type CollisionAvoidance,
  type OffsetFunction,
  type Side,
} from "../../internals/anchor-positioning/createAnchorPositioning";
import { useFloatingRootContext } from "../../internals/floating";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useToastProviderContext } from "../provider/ToastProviderContext";
import * as ToastRootCssVars from "../root/ToastRootCssVars";
import type { ToastObject } from "../useToastManager";
import { ToastPositionerContext } from "./ToastPositionerContext";

const EMPTY_OBJECT: NonNullable<ToastObject<any>["positionerProps"]> = {};

/**
 * Positions the toast against the anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastPositioner<T extends JSX.ElementType = "div">(props: ToastPositioner.Props<T>) {
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
    "toast",
    "class",
    "style",
    "children",
    "ref",
  );
  const toastStore = useToastProviderContext();

  // Toast-level config is structural: snapshot it once so setup-time reads stay
  // one-shot. Local props stay reactive through the getters below. The anchor keeps
  // a live read: it is consumed only inside a tracked effect that no-ops when it
  // is unchanged.
  const toastPositionerProps = props.toast.positionerProps ?? EMPTY_OBJECT;

  const floatingRootContext = useFloatingRootContext({ open: true });

  const positioning = createAnchorPositioning({
    get anchor() {
      const anchor = props.anchor ?? props.toast.positionerProps?.anchor;
      return isElement(anchor) ? anchor : null;
    },
    positionMethod: props.positionMethod ?? toastPositionerProps.positionMethod ?? "absolute",
    side: props.side ?? toastPositionerProps.side ?? "top",
    align: props.align ?? toastPositionerProps.align ?? "center",
    get sideOffset() {
      return props.sideOffset ?? toastPositionerProps.sideOffset ?? 0;
    },
    get alignOffset() {
      return props.alignOffset ?? toastPositionerProps.alignOffset ?? 0;
    },
    collisionBoundary: props.collisionBoundary ?? toastPositionerProps.collisionBoundary ?? "clipping-ancestors",
    collisionPadding: props.collisionPadding ?? toastPositionerProps.collisionPadding ?? 5,
    sticky: props.sticky ?? toastPositionerProps.sticky ?? false,
    arrowPadding: props.arrowPadding ?? toastPositionerProps.arrowPadding ?? 5,
    disableAnchorTracking: props.disableAnchorTracking ?? toastPositionerProps.disableAnchorTracking ?? false,
    keepMounted: true,
    floatingRootContext,
    mounted: () => true,
    collisionAvoidance: props.collisionAvoidance ?? toastPositionerProps.collisionAvoidance ?? POPUP_COLLISION_AVOIDANCE,
  });

  const contextValue: ToastPositionerContext = {
    side: positioning.side,
    align: positioning.align,
    arrowRef: positioning.arrowRef,
    arrowUncentered: positioning.arrowUncentered,
    arrowStyles: positioning.arrowStyles,
  };

  function snapshot(): ToastPositionerState {
    return {
      side: positioning.side(),
      align: positioning.align(),
      anchorHidden: positioning.anchorHidden(),
    };
  }

  function internalStyle(): Record<string, string | undefined> {
    const toast = props.toast;
    const index =
      toast.transitionStatus === "ending"
        ? (toastStore.select("toastIndex", toast.id) as number)
        : (toastStore.select("toastVisibleIndex", toast.id) as number);
    return {
      ...positioning.positionerStyles(),
      // Serializes identically to the numeric value (`--toast-index: 0`).
      [ToastRootCssVars.index]: `${index}`,
      ...(toast.transitionStatus === "starting" ? { transition: "none" } : null),
    } as Record<string, string | undefined>;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const ref = mergeRefs(
    (element: HTMLElement | null) => {
      positioning.refs.setFloating(element);
    },
    props.ref as ((element: HTMLElement | null) => void) | undefined,
  );

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts. The default path renders a static `<div>` so toast
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        role="presentation"
        data-side={positioning.side()}
        data-align={positioning.align()}
        data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue(internalStyle(), resolveStyleValue(props.style, snapshot()))}
        ref={ref}
      >
        <ToastPositionerContext value={contextValue}>
          <ToastPositionerContent snapshot={snapshot}>{props.children}</ToastPositionerContent>
        </ToastPositionerContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
      data-side={positioning.side()}
      data-align={positioning.align()}
      data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(internalStyle(), resolveStyleValue(props.style, snapshot()))}
      ref={ref}
    >
      <ToastPositionerContext value={contextValue}>
        <ToastPositionerContent snapshot={snapshot}>{props.children}</ToastPositionerContent>
      </ToastPositionerContext>
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
export function ToastPositionerContent(props: { children: ToastPositioner.Props["children"]; snapshot: () => ToastPositionerState }) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: ToastPositionerState) => JSX.Element;
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

export interface ToastPositionerState {
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
}

export interface ToastPositionerOwnProps {
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

export interface ToastPositionerToastProp {
  /**
   * The toast object associated with the positioner.
   */
  toast: ToastObject<any>;
}

export type ToastPositionerProps<T extends JSX.ElementType = "div"> = ToastPositionerOwnProps &
  ToastPositionerToastProp &
  RebaseUIComponentProps<T, ToastPositionerState>;

export namespace ToastPositioner {
  export type State = ToastPositionerState;
  export type Props<T extends JSX.ElementType = "div"> = ToastPositionerProps<T>;
  export type OwnProps = ToastPositionerOwnProps;
}
