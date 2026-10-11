import type { Padding, VirtualElement } from "@floating-ui/dom";
import { dynamicElement, effect, getOwner, omitProps, runWithOwner, store as createStore, untrack, type JSX } from "reze-js";

import {
  createAnchorPositioning,
  POPUP_COLLISION_AVOIDANCE,
  type Align,
  type Boundary,
  type CollisionAvoidance,
  type OffsetFunction,
  type Side,
} from "../../internals/anchor-positioning/createAnchorPositioning";
import { REASONS } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { createScrollLock } from "../../internals/scroll-lock";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useTriggerSwitchTransition } from "../../internals/useTriggerSwitchTransition";
import { usePopoverPortalContext } from "../portal/PopoverPortalContext";
import { usePopoverRootContext } from "../root/PopoverRootContext";
import { InternalBackdrop } from "./InternalBackdrop";
import { PopoverPositionerContext } from "./PopoverPositionerContext";

// Touch-opened popups normally avoid scroll locking so users can still swipe outside to dismiss.
// Scroll lock is re-enabled only when the popup is effectively full-width: popups with up to
// 20px of total horizontal gutter still lock, since that leaves too little outside space.
const VIEWPORT_WIDTH_TOLERANCE_PX = 20;

/**
 * Positions the popover against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Popover](https://rebase-ui.knst.dev/components/popover)
 */
export function PopoverPositioner<T extends JSX.ElementType = "div">(props: PopoverPositioner.Props<T>) {
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
  // context provider below, not in this body. The snapshot reads subscribe each binding
  // they resolve in, so reading them here would also poison the body with state reads.

  const store = usePopoverRootContext();
  const keepMounted = usePopoverPortalContext();

  const positioning = createAnchorPositioning({
    get anchor() {
      return props.anchor;
    },
    positionMethod: props.positionMethod ?? "absolute",
    side: props.side ?? "top",
    align: props.align ?? "center",
    sideOffset: props.sideOffset ?? 0,
    alignOffset: props.alignOffset ?? 0,
    collisionBoundary: props.collisionBoundary ?? "clipping-ancestors",
    collisionPadding: props.collisionPadding ?? 5,
    sticky: props.sticky ?? false,
    arrowPadding: props.arrowPadding ?? 5,
    disableAnchorTracking: props.disableAnchorTracking ?? false,
    keepMounted,
    floatingRootContext: untrack(() => store.select("floatingRootContext")),
    mounted: () => store.select("mounted"),
    collisionAvoidance: props.collisionAvoidance ?? POPUP_COLLISION_AVOIDANCE,
    get adaptiveOrigin() {
      return store.select("adaptiveOrigin");
    },
  });

  const floatingRootContext = untrack(() => store.select("floatingRootContext"));
  useTriggerSwitchTransition({
    store,
    domReference: () => floatingRootContext.select("domReferenceElement") as Element | null,
    positionerElement: () => store.select("positionerElement") as HTMLElement | null,
    open: () => store.select("open") as boolean,
  });

  const isModalNonHover = () =>
    (store.select("modal") as boolean | "trap-focus") === true && (store.select("openChangeReason") as string | null) !== REASONS.triggerHover;

  const isOpenModalNonHover = () => (store.select("open") as boolean) && isModalNonHover();

  // Touch-opened popups avoid scroll locking unless effectively full-width.
  const touchLock = createStore({ shouldLock: false });
  effect(() => {
    const enabled = isOpenModalNonHover();
    const touchOpen = (store.select("openMethod") as string | null) === "touch";
    const positionerElement = store.select("positionerElement") as HTMLElement | null;
    // One-shot measurement: the values only steer this write.
    untrack(() => {
      if (!enabled || !touchOpen || positionerElement == null) {
        if (touchLock.shouldLock !== false) {
          touchLock.shouldLock = false;
        }
        return;
      }
      const viewportWidth = positionerElement.ownerDocument.documentElement.clientWidth;
      const popupWidth = positionerElement.offsetWidth;
      const shouldLock = viewportWidth > 0 && popupWidth > 0 && popupWidth >= viewportWidth - VIEWPORT_WIDTH_TOLERANCE_PX;
      if (touchLock.shouldLock !== shouldLock) {
        touchLock.shouldLock = shouldLock;
      }
    });
  });

  createScrollLock({
    enabled: () => {
      const enabled = isOpenModalNonHover();
      const touchOpen = (store.select("openMethod") as string | null) === "touch";
      return enabled && (!touchOpen || touchLock.shouldLock);
    },
  });

  function snapshot(): PopoverPositionerState {
    return {
      open: store.select("open"),
      side: positioning.side(),
      align: positioning.align(),
      anchorHidden: positioning.anchorHidden(),
      instant: store.select("instantType"),
    };
  }

  const showInternalBackdrop = () => (store.select("mounted") as boolean) && isModalNonHover();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the positioner parts without context. Children
  // resolve in PopoverPositionerContent below so they are created inside the provider.
  //
  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the positioner's anchored styles
  // and recreate the whole popup subtree every time the modal backdrop appears or
  // disappears. The default path renders a static `<div>` so open/close transitions
  // patch it in place; only a customized `as` keeps the dynamic tag. Keep both
  // branches in sync.
  if (props.as == null) {
    return (
      <>
        {showInternalBackdrop() && <InternalBackdrop cutout={(store.select("activeTriggerElement") as Element | null) ?? undefined} />}
        <div
          {...(rest as Record<string, unknown>)}
          role="presentation"
          hidden={!store.select("mounted") || undefined}
          inert={!store.select("open") || undefined}
          data-open={store.select("open") ? "" : undefined}
          data-closed={store.select("open") ? undefined : ""}
          data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
          data-side={positioning.side()}
          data-align={positioning.align()}
          data-instant={store.select("instantType") ?? undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={mergeStyleValue(
            {
              ...positioning.positionerStyles(),
              ...(store.select("transitionStatus") === "starting" ? { transition: "none" } : null),
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
          <PopoverPositionerContext
            value={{
              side: positioning.side,
              align: positioning.align,
              arrowRef: positioning.arrowRef,
              arrowUncentered: positioning.arrowUncentered,
              arrowStyles: positioning.arrowStyles,
            }}
          >
            <PopoverPositionerContent
              open={store.select("open") as boolean}
              side={positioning.side()}
              align={positioning.align()}
              anchorHidden={positioning.anchorHidden()}
              instant={store.select("instantType")}
            >
              {props.children}
            </PopoverPositionerContent>
          </PopoverPositionerContext>
        </div>
      </>
    );
  }

  return (
    <>
      {showInternalBackdrop() && <InternalBackdrop cutout={(store.select("activeTriggerElement") as Element | null) ?? undefined} />}
      <Tag
        {...(rest as Record<string, unknown>)}
        role="presentation"
        hidden={!store.select("mounted") || undefined}
        inert={!store.select("open") || undefined}
        data-open={store.select("open") ? "" : undefined}
        data-closed={store.select("open") ? undefined : ""}
        data-anchor-hidden={positioning.anchorHidden() ? "" : undefined}
        data-side={positioning.side()}
        data-align={positioning.align()}
        data-instant={store.select("instantType") ?? undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue(
          {
            ...positioning.positionerStyles(),
            ...(store.select("transitionStatus") === "starting" ? { transition: "none" } : null),
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
        <PopoverPositionerContext
          value={{
            side: positioning.side,
            align: positioning.align,
            arrowRef: positioning.arrowRef,
            arrowUncentered: positioning.arrowUncentered,
            arrowStyles: positioning.arrowStyles,
          }}
        >
          <PopoverPositionerContent
            open={store.select("open") as boolean}
            side={positioning.side()}
            align={positioning.align()}
            anchorHidden={positioning.anchorHidden()}
            instant={store.select("instantType")}
          >
            {props.children}
          </PopoverPositionerContent>
        </PopoverPositionerContext>
      </Tag>
    </>
  );
}

/**
 * Resolves the positioner children inside the positioner context. Render-prop
 * children are invoked inside a thunk (bound by the renderer) and re-invoked
 * with a fresh state snapshot whenever the positioner state changes.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives
 * return thunks, and invoking one here would resolve the subtree one-shot
 * instead of binding it.
 */
function PopoverPositionerContent(props: {
  children: unknown;
  open: boolean;
  side: Side;
  align: Align;
  anchorHidden: boolean;
  instant: string | undefined;
}) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: PopoverPositionerState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the positioner context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: PopoverPositionerState = {
        open: props.open,
        side: props.side,
        align: props.align,
        anchorHidden: props.anchorHidden,
        instant: props.instant,
      };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface PopoverPositionerState {
  /**
   * Whether the popover is currently open.
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

export interface PopoverPositionerOwnProps {
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

export type PopoverPositionerProps<T extends JSX.ElementType = "div"> = PopoverPositionerOwnProps &
  RebaseUIComponentProps<T, PopoverPositionerState>;

export namespace PopoverPositioner {
  export type State = PopoverPositionerState;
  export type Props<T extends JSX.ElementType = "div"> = PopoverPositionerProps<T>;
}
