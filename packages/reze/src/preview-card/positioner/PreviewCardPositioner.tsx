import { dynamicElement, getOwner, omitProps, runWithOwner, untrack, type JSX } from "reze-js";

import type { Padding, VirtualElement } from "@floating-ui/dom";

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
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePreviewCardPortalContext } from "../portal/PreviewCardPortalContext";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";
import { createInlineMiddleware } from "../utils/inlineRect";
import { PreviewCardPositionerContext } from "./PreviewCardPositionerContext";

/**
 * Positions the popup against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardPositioner<T extends JSX.ElementType = "div">(props: PreviewCardPositioner.Props<T>) {
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

  const store = usePreviewCardRootContext();
  const keepMounted = usePreviewCardPortalContext();

  const positioning = createAnchorPositioning({
    get anchor() {
      return props.anchor;
    },
    positionMethod: props.positionMethod ?? "absolute",
    side: props.side ?? "bottom",
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
    inline: createInlineMiddleware(store.context.inlineRectCoordsRef),
  });

  const contextValue: PreviewCardPositionerContext = {
    side: positioning.side,
    align: positioning.align,
    arrowRef: positioning.arrowRef,
    arrowUncentered: positioning.arrowUncentered,
    arrowStyles: positioning.arrowStyles,
  };

  function snapshot(): PreviewCardPositionerState {
    return {
      open: store.select("open") as boolean,
      side: positioning.side(),
      align: positioning.align(),
      anchorHidden: positioning.anchorHidden(),
      instant: store.select("instantType"),
    };
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the positioner parts without context. Children
  // resolve in PreviewCardPositionerContent below so they are created inside the provider.
  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
      hidden={!(store.select("mounted") as boolean) || undefined}
      inert={!(store.select("open") as boolean)}
      data-open={(store.select("open") as boolean) ? "" : undefined}
      data-closed={(store.select("open") as boolean) ? undefined : ""}
      data-side={positioning.side()}
      data-align={positioning.align()}
      data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
      data-instant={(store.select("instantType") as string | undefined) ?? undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(
        {
          ...positioning.positionerStyles(),
          ...((store.select("transitionStatus") as string | undefined) === "starting" ? { transition: "none" } : null),
        } as Record<string, string | undefined>,
        resolveStyleValue(props.style, snapshot()),
      )}
      ref={mergeRefs(
        (element: HTMLElement | null) => {
          positioning.refs.setFloating(element);
          store.set("positionerElement", element);
        },
        props.ref as ((element: HTMLElement | null) => void) | undefined,
      )}
    >
      <PreviewCardPositionerContext value={contextValue}>
        <PreviewCardPositionerContent snapshot={snapshot}>{props.children}</PreviewCardPositionerContent>
      </PreviewCardPositionerContext>
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
export function PreviewCardPositionerContent(props: {
  children: PreviewCardPositioner.Props["children"];
  snapshot: () => PreviewCardPositionerState;
}) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: PreviewCardPositionerState) => JSX.Element;
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

export interface PreviewCardPositionerState {
  /**
   * Whether the preview card is currently open.
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
   * Whether transitions should be skipped.
   */
  instant: "dismiss" | "focus" | undefined;
}

export interface PreviewCardPositionerOwnProps {
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

export type PreviewCardPositionerProps<T extends JSX.ElementType = "div"> = PreviewCardPositionerOwnProps &
  RebaseUIComponentProps<T, PreviewCardPositionerState>;

export namespace PreviewCardPositioner {
  export type State = PreviewCardPositionerState;
  export type Props<T extends JSX.ElementType = "div"> = PreviewCardPositionerProps<T>;
}
