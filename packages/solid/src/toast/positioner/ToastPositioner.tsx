import type { Padding, VirtualElement } from "@floating-ui/dom";
import { isElement } from "@floating-ui/utils/dom";
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
import { useFloatingRootContext } from "../../internals/floating/useFloatingRootContext";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { EMPTY_OBJECT } from "../../internals/utils/empty";
import { useToastProviderContext } from "../provider/ToastProviderContext";
import * as ToastRootCssVars from "../root/ToastRootCssVars";
import type { ToastObject } from "../useToastManager";
import { toastPositionerStateMapping } from "../utils/stateAttributesMapping";
import { ToastPositionerContext } from "./ToastPositionerContext";

/**
 * Positions the toast against the anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastPositioner<T extends ValidComponent = "div">(props: ToastPositioner.Props<T>) {
  const [local, elementProps] = split(props as ToastPositioner.Props, { default: defaultProps }, [
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
  ]);

  const as = untrack(() => local.as);

  const store = useToastProviderContext();

  // Toast-level config is structural: snapshot it once so setup-time reads stay
  // one-shot and silent. Anchor positioning destructures params eagerly in an
  // untracked scope, so a live `local.toast` read there would warn. Local props
  // stay reactive through the getters below. The anchor keeps a live read: it is
  // consumed only inside a tracked effect that no-ops when it is unchanged.
  const toastPositionerProps = untrack(
    () => (local.toast.positionerProps ?? EMPTY_OBJECT) as NonNullable<ToastObject<any>["positionerProps"]>,
  );

  const anchorProp = () => local.anchor ?? local.toast.positionerProps?.anchor;

  const floatingRootContext = useFloatingRootContext({ open: true });

  const positioning = createAnchorPositioning({
    get anchor() {
      const anchor = anchorProp();
      return isElement(anchor) ? anchor : null;
    },
    positionMethod: untrack(() => local.positionMethod ?? toastPositionerProps.positionMethod ?? "absolute"),
    side: untrack(() => local.side ?? toastPositionerProps.side ?? "top"),
    align: untrack(() => local.align ?? toastPositionerProps.align ?? "center"),
    get sideOffset() {
      return local.sideOffset ?? toastPositionerProps.sideOffset ?? 0;
    },
    get alignOffset() {
      return local.alignOffset ?? toastPositionerProps.alignOffset ?? 0;
    },
    collisionBoundary: untrack(() => local.collisionBoundary ?? toastPositionerProps.collisionBoundary ?? "clipping-ancestors"),
    collisionPadding: untrack(() => local.collisionPadding ?? toastPositionerProps.collisionPadding ?? 5),
    sticky: untrack(() => local.sticky ?? toastPositionerProps.sticky ?? false),
    arrowPadding: untrack(() => local.arrowPadding ?? toastPositionerProps.arrowPadding ?? 5),
    disableAnchorTracking: untrack(() => local.disableAnchorTracking ?? toastPositionerProps.disableAnchorTracking ?? false),
    keepMounted: true,
    floatingRootContext,
    mounted: () => true,
    collisionAvoidance: untrack(() => local.collisionAvoidance ?? toastPositionerProps.collisionAvoidance) ?? POPUP_COLLISION_AVOIDANCE,
  });

  const state: ToastPositionerState = {
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

  const positionerPropsAttribute = {
    role: "presentation" as const,
    get style(): import("@solidjs/web").JSX.CSSProperties {
      const toast = local.toast;
      const index =
        toast.transitionStatus === "ending"
          ? (store.select("toastIndex", toast.id) as number)
          : (store.select("toastVisibleIndex", toast.id) as number);
      return {
        ...positioning.positionerStyles(),
        [ToastRootCssVars.index]: index,
      } as import("@solidjs/web").JSX.CSSProperties;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, (element: HTMLElement | null) => {
      positioning.refs.setFloating(element);
    }),
  });

  return (
    <ToastPositionerContext
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
        props={[positionerPropsAttribute, getDisabledMountTransitionStyles(() => local.toast.transitionStatus), elementProps, refProps]}
        stateAttributesMapping={toastPositionerStateMapping}
      />
    </ToastPositionerContext>
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
} satisfies Partial<ToastPositioner.Props>);

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

export type ToastPositionerProps<T extends ValidComponent = "div"> = ToastPositionerOwnProps &
  ToastPositionerToastProp &
  RebaseUIComponentProps<T, ToastPositionerState>;

export namespace ToastPositioner {
  export type State = ToastPositionerState;
  export type Props<T extends ValidComponent = "div"> = ToastPositionerProps<T>;
  export type OwnProps = ToastPositionerOwnProps;
}
