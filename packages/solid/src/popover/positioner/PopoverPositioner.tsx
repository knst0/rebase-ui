import type { Padding, VirtualElement } from "@floating-ui/dom";
import type { ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, untrack } from "solid-js";

import {
  createAnchorPositioning,
  POPUP_COLLISION_AVOIDANCE,
  type Align,
  type Boundary,
  type CollisionAvoidance,
  type OffsetFunction,
  type Side,
} from "../../internals/anchor-positioning/createAnchorPositioning";
import { createAnimationsFinishedRunner } from "../../internals/createAnimationsFinishedRunner";
import { REASONS } from "../../internals/event-details";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { createScrollLock } from "../../internals/scroll-lock";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { usePopoverPortalContext } from "../portal/PopoverPortalContext";
import { usePopoverRootContext } from "../root/PopoverRootContext";
import { popoverPositionerStateMapping } from "../utils/stateAttributesMapping";
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
export function PopoverPositioner<T extends ValidComponent = "div">(props: PopoverPositioner.Props<T>) {
  const [local, elementProps] = split(props as PopoverPositioner.Props, { default: defaultProps }, [
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

  const store = usePopoverRootContext();
  const keepMounted = usePopoverPortalContext();

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
  });

  const runOnceAnimationsFinish = createAnimationsFinishedRunner(() => store.select("positionerElement") as HTMLElement | null);

  // When the current trigger element changes, enable transitions on the
  // positioner temporarily.
  const floatingRootContext = untrack(() => store.select("floatingRootContext"));
  const [previousTriggerElement, setPreviousTriggerElement] = createSignal<Element | null>(null, { ownedWrite: true });
  createEffect(
    () => floatingRootContext.select("domReferenceElement") as Element | null,
    (currentTriggerElement) => {
      const previousTriggerElementValue = untrack(previousTriggerElement);
      if (currentTriggerElement) {
        setPreviousTriggerElement(currentTriggerElement);
      }
      if (previousTriggerElementValue && currentTriggerElement && currentTriggerElement !== previousTriggerElementValue) {
        store.set("instantType", undefined);
        const controller = new AbortController();
        runOnceAnimationsFinish(() => {
          store.set("instantType", "trigger-change");
        }, controller.signal);
        return () => {
          controller.abort();
        };
      }
      return undefined;
    },
  );

  const isModalNonHover = () =>
    (store.select("modal") as boolean | "trap-focus") === true &&
    (store.select("openChangeReason") as string | null) !== REASONS.triggerHover;

  const isOpenModalNonHover = () => (store.select("open") as boolean) && isModalNonHover();

  // Touch-opened popups avoid scroll locking unless effectively full-width.
  const [touchOpenShouldLockScroll, setTouchOpenShouldLockScroll] = createSignal(false, { ownedWrite: true });
  createEffect(
    () => ({
      enabled: isOpenModalNonHover(),
      touchOpen: (store.select("openMethod") as string | null) === "touch",
      positionerElement: store.select("positionerElement") as HTMLElement | null,
    }),
    ({ enabled, touchOpen, positionerElement }) => {
      if (!enabled || !touchOpen || positionerElement == null) {
        setTouchOpenShouldLockScroll(false);
        return undefined;
      }
      const viewportWidth = positionerElement.ownerDocument.documentElement.clientWidth;
      const popupWidth = positionerElement.offsetWidth;
      setTouchOpenShouldLockScroll(viewportWidth > 0 && popupWidth > 0 && popupWidth >= viewportWidth - VIEWPORT_WIDTH_TOLERANCE_PX);
      return undefined;
    },
  );

  createScrollLock({
    enabled: () => {
      const enabled = isOpenModalNonHover();
      const touchOpen = (store.select("openMethod") as string | null) === "touch";
      return enabled && (!touchOpen || touchOpenShouldLockScroll());
    },
  });

  const state: PopoverPositionerState = {
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

  const showInternalBackdrop = () => (store.select("mounted") as boolean) && isModalNonHover();

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
    <PopoverPositionerContext
      value={{
        side: positioning.side,
        align: positioning.align,
        arrowRef: positioning.arrowRef,
        arrowUncentered: positioning.arrowUncentered,
        arrowStyles: positioning.arrowStyles,
      }}
    >
      {(() => {
        const triggerElement = () => store.select("activeTriggerElement") as Element | null;
        return showInternalBackdrop() ? <InternalBackdrop cutout={triggerElement() ?? undefined} /> : null;
      })()}
      <RenderElement
        as={as}
        state={state}
        props={[positionerProps, getDisabledMountTransitionStyles(() => store.select("transitionStatus")), elementProps, refProps]}
        stateAttributesMapping={popoverPositionerStateMapping}
      />
    </PopoverPositionerContext>
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
  side: "top",
  align: "center",
  sideOffset: 0,
  alignOffset: 0,
  collisionBoundary: "clipping-ancestors",
  collisionPadding: 5,
  arrowPadding: 5,
  sticky: false,
  disableAnchorTracking: false,
} satisfies Partial<PopoverPositioner.Props>);

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

export type PopoverPositionerProps<T extends ValidComponent = "div"> = PopoverPositionerOwnProps &
  RebaseUIComponentProps<T, PopoverPositionerState>;

export namespace PopoverPositioner {
  export type State = PopoverPositionerState;
  export type Props<T extends ValidComponent = "div"> = PopoverPositionerProps<T>;
}
