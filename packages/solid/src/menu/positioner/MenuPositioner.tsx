import type { Padding, VirtualElement } from "@floating-ui/dom";
import type { JSX, ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, onCleanup, untrack } from "solid-js";

import {
  createAnchorPositioning,
  POPUP_COLLISION_AVOIDANCE,
  type Align,
  type Boundary,
  type CollisionAvoidance,
  type OffsetFunction,
  type Side,
} from "../../internals/anchor-positioning/createAnchorPositioning";
import { CompositeListContext, createCompositeList } from "../../internals/composite";
import { createAnimationsFinishedRunner } from "../../internals/createAnimationsFinishedRunner";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { Timeout } from "../../internals/floating/interactions/createHoverInteractionSharedState";
import { FloatingNode } from "../../internals/floating/tree/FloatingTree";
import type { FloatingTreeStore } from "../../internals/floating/tree/FloatingTreeStore";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { createScrollLock } from "../../internals/scroll-lock";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useMenuPortalContext } from "../portal/MenuPortalContext";
import type { MenuRoot } from "../root/MenuRoot";
import { useMenuRootContext } from "../root/MenuRootContext";
import { menuPositionerStateMapping } from "../utils/stateAttributesMapping";
import type { MenuOpenEventDetails } from "../utils/types";
import { InternalBackdrop } from "./InternalBackdrop";
import { MenuPositionerContext } from "./MenuPositionerContext";

const DROPDOWN_COLLISION_AVOIDANCE = {
  fallbackAxisSide: "none",
} as const;

// Touch-opened popups normally avoid scroll locking so users can still swipe outside to dismiss.
// Scroll lock is re-enabled only when the popup is effectively full-width: popups with up to
// 20px of total horizontal gutter still lock, since that leaves too little outside space.
const VIEWPORT_WIDTH_TOLERANCE_PX = 20;

/**
 * Positions the menu popup against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuPositioner<T extends ValidComponent = "div">(props: MenuPositioner.Props<T>) {
  const [local, elementProps] = split(props as MenuPositioner.Props, { default: defaultProps }, [
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

  const { store, parent } = useMenuRootContext();
  const keepMounted = useMenuPortalContext();

  const isSubmenu = parent.type === "menu";

  const positioning = createAnchorPositioning({
    // One-shot read: the node id is seeded synchronously by the root before the positioner
    // mounts, and it feeds the safe polygon's open-child guard via the floating context.
    nodeId: untrack(() => store.peek("floatingNodeId")) as string | undefined,
    // Solid portals (`<Portal mount>`) create a fresh owner, so the ambient
    // `FloatingTreeContext` is unavailable inside them. Pass the shared tree explicitly so
    // tree nodes receive live element contexts (used by focus-outside ancestor checks and
    // descendant guards). Mirrors the explicit `externalTree` in `createMenuRoot`.
    externalTree: untrack(() => store.select("floatingTreeRoot")) as FloatingTreeStore | undefined,
    get anchor() {
      return local.anchor;
    },
    positionMethod: untrack(() => local.positionMethod),
    side: untrack(() => local.side) ?? (isSubmenu ? "inline-end" : undefined),
    align: untrack(() => local.align) ?? (isSubmenu ? "start" : undefined),
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
    collisionAvoidance: untrack(() => local.collisionAvoidance) ?? (isSubmenu ? POPUP_COLLISION_AVOIDANCE : DROPDOWN_COLLISION_AVOIDANCE),
    get adaptiveOrigin() {
      return store.select("adaptiveOrigin");
    },
  });

  const floatingTreeRoot = untrack(() => store.select("floatingTreeRoot"));
  // One-shot read: `FloatingNode` consumes the id untracked (once), and the id is seeded
  // synchronously by the root, so there is nothing to subscribe to here.
  const floatingNodeId = untrack(() => store.peek("floatingNodeId")) as string | undefined;

  const closeTimeout = new Timeout();
  let closePending = false;
  function clearPendingClose() {
    closePending = false;
    closeTimeout.clear();
  }
  onCleanup(() => clearPendingClose());

  function onMenuOpenChange(details: MenuOpenEventDetails) {
    const nodeId = store.peek("floatingNodeId") as string | undefined;
    if (details.open) {
      if (details.parentNodeId === nodeId) {
        store.set("hoverEnabled", false);
      }
      if (details.nodeId !== nodeId && details.parentNodeId === (store.peek("floatingParentNodeId") as string | null)) {
        store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
      }
    }
  }

  // Close when the parent menu closes.
  function onParentClose(details: MenuOpenEventDetails) {
    if (store.peek("floatingParentNodeId") == null) {
      return;
    }
    if (details.open || details.nodeId !== (store.peek("floatingParentNodeId") as string | null)) {
      return;
    }

    const reason: MenuRoot.ChangeEventReason = details.reason ?? REASONS.siblingOpen;
    store.setOpen(false, createChangeEventDetails(reason));
  }

  // Close unrelated child submenus when hovering a different item in the parent menu.
  function onItemHover(event: { nodeId: string | undefined; target: Element | null }) {
    const open = store.peek("open") as boolean;
    if (!open || event.nodeId !== (store.peek("floatingParentNodeId") as string | null)) {
      return;
    }

    const triggerElement = store.peek("activeTriggerElement") as Element | null;
    if (event.target && triggerElement && triggerElement !== event.target) {
      const delay = store.peek("closeDelay") as number;
      if (delay > 0) {
        if (!closePending) {
          closePending = true;
          closeTimeout.start(delay, () => {
            closePending = false;
            store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
          });
        }
      } else {
        store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
      }
    } else {
      // User re-hovered the submenu trigger, cancel pending close.
      clearPendingClose();
    }
  }

  floatingTreeRoot.events.on("menuopenchange", onMenuOpenChange);
  floatingTreeRoot.events.on("menuopenchange", onParentClose);
  floatingTreeRoot.events.on("itemhover", onItemHover);
  onCleanup(() => {
    floatingTreeRoot.events.off("menuopenchange", onMenuOpenChange);
    floatingTreeRoot.events.off("menuopenchange", onParentClose);
    floatingTreeRoot.events.off("itemhover", onItemHover);
  });

  // Clear pending close timeout when the menu closes.
  createEffect(
    () => store.select("open") as boolean,
    (open) => {
      if (!open) {
        clearPendingClose();
      }
      return undefined;
    },
  );

  // Broadcast open changes so sibling and parent menus can coordinate.
  createEffect(
    () => ({
      open: store.select("open") as boolean,
      nodeId: store.select("floatingNodeId") as string | undefined,
      parentNodeId: store.select("floatingParentNodeId") as string | null,
      reason: store.select("lastOpenChangeReason") as MenuRoot.ChangeEventReason | null,
    }),
    ({ open, nodeId, parentNodeId, reason }) => {
      const eventDetails: MenuOpenEventDetails = { open, nodeId, parentNodeId, reason };
      floatingTreeRoot.events.emit("menuopenchange", eventDetails);
      return undefined;
    },
  );

  const runOnceAnimationsFinish = createAnimationsFinishedRunner(() => store.select("positionerElement") as HTMLElement | null);

  // When the current trigger element changes, enable transitions on the
  // positioner temporarily.
  const rootFloatingContext = untrack(() => store.select("floatingRootContext"));
  const [previousTriggerElement, setPreviousTriggerElement] = createSignal<Element | null>(null, { ownedWrite: true });
  createEffect(
    () => rootFloatingContext.select("domReferenceElement") as Element | null,
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

  const compositeList = createCompositeList<{ label?: string | null }>();

  // Mirrors the composite registry into the store refs that keyboard navigation
  // and typeahead consume.
  createEffect(
    () => compositeList.map(),
    (map) => {
      const nextElements = Array.from<HTMLElement | null>({ length: map.size });
      const nextLabels = Array.from<string | null>({ length: map.size });
      for (const [element, entry] of map) {
        nextElements[entry.index] = element;
        nextLabels[entry.index] = entry.label ?? element.textContent ?? null;
      }
      store.context.itemDomElements.current = nextElements;
      store.context.itemLabels.current = nextLabels;
      return undefined;
    },
  );

  const isModalNonHover = () =>
    (store.select("modal") as boolean | undefined) === true &&
    (store.select("lastOpenChangeReason") as string | null) !== REASONS.triggerHover;

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

  const state: MenuPositionerState = {
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
    get nested() {
      return isSubmenu;
    },
    get instant() {
      return store.select("instantType");
    },
  };

  const showInternalBackdrop = () => (store.select("mounted") as boolean) && !isSubmenu && isModalNonHover();

  const positionerProps = {
    role: "presentation" as const,
    get hidden() {
      return !store.select("mounted") || undefined;
    },
    get inert() {
      return !store.select("open") || undefined;
    },
    get style(): JSX.CSSProperties {
      return { ...positioning.positionerStyles() } as JSX.CSSProperties;
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLElement>(externalProps.ref, (element: HTMLElement | null) => {
      positioning.refs.setFloating(element);
      store.set("positionerElement", element);
    }),
  });

  return (
    <MenuPositionerContext
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
      <FloatingNode id={floatingNodeId}>
        <CompositeListContext value={compositeList.contextValue}>
          <RenderElement
            as={as}
            state={state}
            props={[positionerProps, getDisabledMountTransitionStyles(() => store.select("transitionStatus")), elementProps, refProps]}
            stateAttributesMapping={menuPositionerStateMapping}
          />
        </CompositeListContext>
      </FloatingNode>
    </MenuPositionerContext>
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
  sideOffset: 0,
  alignOffset: 0,
  collisionBoundary: "clipping-ancestors",
  collisionPadding: 5,
  arrowPadding: 5,
  sticky: false,
  disableAnchorTracking: false,
} satisfies Partial<MenuPositioner.Props>);

export interface MenuPositionerState {
  /**
   * Whether the menu is currently open.
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
   * Whether the component is nested.
   */
  nested: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: string | undefined;
}

export interface MenuPositionerOwnProps {
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
   *
   * Submenus default to `'inline-end'`.
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
   *
   * Submenus default to `'start'`.
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

export type MenuPositionerProps<T extends ValidComponent = "div"> = MenuPositionerOwnProps & RebaseUIComponentProps<T, MenuPositionerState>;

export namespace MenuPositioner {
  export type State = MenuPositionerState;
  export type Props<T extends ValidComponent = "div"> = MenuPositionerProps<T>;
  export type OwnProps = MenuPositionerOwnProps;
}
