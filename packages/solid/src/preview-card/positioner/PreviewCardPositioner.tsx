import type { Padding, VirtualElement } from "@floating-ui/dom";
import type { ValidComponent } from "@solidjs/web";
import { untrack } from "solid-js";

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
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePreviewCardPortalContext } from "../portal/PreviewCardPortalContext";
import { usePreviewCardRootContext } from "../root/PreviewCardRootContext";
import { createInlineMiddleware } from "../utils/inlineRect";
import { previewCardPositionerStateMapping } from "../utils/stateAttributesMapping";
import { PreviewCardPositionerContext } from "./PreviewCardPositionerContext";

/**
 * Positions the popup against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Preview Card](https://rebase-ui.knst.dev/components/preview-card)
 */
export function PreviewCardPositioner<T extends ValidComponent = "div">(props: PreviewCardPositioner.Props<T>) {
  const [local, elementProps] = split(props as PreviewCardPositioner.Props, { default: defaultProps }, [
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

  const store = usePreviewCardRootContext();
  const keepMounted = usePreviewCardPortalContext();

  const positioning = createAnchorPositioning({
    get anchor() {
      return local.anchor;
    },
    positionMethod: untrack(() => local.positionMethod),
    side: untrack(() => local.side),
    align: untrack(() => local.align),
    get sideOffset() {
      return local.sideOffset;
    },
    get alignOffset() {
      return local.alignOffset;
    },
    collisionBoundary: untrack(() => local.collisionBoundary),
    collisionPadding: untrack(() => local.collisionPadding),
    sticky: untrack(() => local.sticky),
    arrowPadding: untrack(() => local.arrowPadding),
    disableAnchorTracking: untrack(() => local.disableAnchorTracking) ?? false,
    keepMounted,
    floatingRootContext: untrack(() => store.select("floatingRootContext")),
    mounted: () => store.select("mounted"),
    collisionAvoidance: untrack(() => local.collisionAvoidance) ?? POPUP_COLLISION_AVOIDANCE,
    get adaptiveOrigin() {
      return store.select("adaptiveOrigin");
    },
    inline: createInlineMiddleware(store.context.inlineRectCoordsRef),
  });

  const state: PreviewCardPositionerState = {
    get open() {
      return store.select("open");
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
      return store.select("instantType");
    },
  };

  const positionerProps = {
    role: "presentation" as const,
    get hidden() {
      return !store.select("mounted") || undefined;
    },
    get inert() {
      return !store.select("open") || undefined;
    },
    get style(): import("@solidjs/web").JSX.CSSProperties {
      return { ...positioning.positionerStyles() } as import("@solidjs/web").JSX.CSSProperties;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, (element: HTMLElement | null) => {
      positioning.refs.setFloating(element);
      store.set("positionerElement", element);
    }),
  });

  return (
    <PreviewCardPositionerContext
      value={{
        side: positioning.side,
        align: positioning.align,
        arrowRef: positioning.arrowRef,
        arrowUncentered: positioning.arrowUncentered,
        arrowStyles: positioning.arrowStyles,
      }}
    >
      <RenderElement
        as={as}
        state={state}
        props={[positionerProps, getDisabledMountTransitionStyles(() => store.select("transitionStatus")), elementProps, refProps]}
        stateAttributesMapping={previewCardPositionerStateMapping}
      />
    </PreviewCardPositionerContext>
  );
}

function getDisabledMountTransitionStyles(transitionStatus: () => string | undefined) {
  return {
    get style() {
      return transitionStatus() === "starting" ? { transition: "none" } : undefined;
    },
  };
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
} satisfies Partial<PreviewCardPositioner.Props>);

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

export type PreviewCardPositionerProps<T extends ValidComponent = "div"> = PreviewCardPositionerOwnProps &
  RebaseUIComponentProps<T, PreviewCardPositionerState>;

export namespace PreviewCardPositioner {
  export type State = PreviewCardPositionerState;
  export type Props<T extends ValidComponent = "div"> = PreviewCardPositionerProps<T>;
}
