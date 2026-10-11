import type { Padding, VirtualElement } from "@floating-ui/dom";
import { dynamicElement, effect, omitProps, onCleanup, store as createStore, untrack, type JSX } from "reze-js";

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
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { Timeout } from "../../internals/floating/interactions/createHoverInteractionSharedState";
import { FloatingNode } from "../../internals/floating/tree/FloatingTree";
import type { FloatingTreeStore } from "../../internals/floating/tree/FloatingTreeStore";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { createScrollLock } from "../../internals/scroll-lock";
import type { RebaseUIComponentProps } from "../../internals/types";
import { useTriggerSwitchTransition } from "../../internals/useTriggerSwitchTransition";
import { useMenuPortalContext } from "../portal/MenuPortalContext";
import type { MenuRoot } from "../root/MenuRoot";
import { useMenuRootContext } from "../root/MenuRootContext";
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
export function MenuPositioner<T extends JSX.ElementType = "div">(props: MenuPositioner.Props<T>) {
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

  const { store, parent, virtualFocus } = useMenuRootContext();
  const keepMounted = useMenuPortalContext();

  const isSubmenu = parent.type === "menu";

  const positioning = createAnchorPositioning({
    // One-shot read: the node id is seeded synchronously by the root before the positioner
    // mounts, and it feeds the safe polygon's open-child guard via the floating context.
    nodeId: untrack(() => store.peek("floatingNodeId")) as string | undefined,
    // Reze portals create a fresh owner, so the ambient `FloatingTreeContext` is unavailable
    // inside them. Pass the shared tree explicitly so tree nodes receive live element contexts
    // (used by focus-outside ancestor checks and descendant guards). Mirrors the explicit
    // `externalTree` in `createMenuRoot`.
    externalTree: untrack(() => store.select("floatingTreeRoot")) as FloatingTreeStore | undefined,
    get anchor() {
      return props.anchor;
    },
    positionMethod: props.positionMethod ?? "absolute",
    side: props.side ?? (isSubmenu ? "inline-end" : undefined),
    align: props.align ?? (isSubmenu ? "start" : undefined),
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
    mounted: () => store.select("mounted"),
    lazyFlip: virtualFocus ? "placement" : false,
    collisionAvoidance: props.collisionAvoidance ?? (isSubmenu ? POPUP_COLLISION_AVOIDANCE : DROPDOWN_COLLISION_AVOIDANCE),
    get adaptiveOrigin() {
      return store.select("adaptiveOrigin");
    },
  });

  const floatingTreeRoot = untrack(() => store.select("floatingTreeRoot")) as FloatingTreeStore;
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
  effect(() => {
    const open = store.select("open") as boolean;
    // One-shot write: the value only steers this write.
    untrack(() => {
      if (!open) {
        clearPendingClose();
      }
    });
  });

  // Broadcast open changes so sibling and parent menus can coordinate.
  effect(() => {
    const open = store.select("open") as boolean;
    const nodeId = store.select("floatingNodeId") as string | undefined;
    const parentNodeId = store.select("floatingParentNodeId") as string | null;
    const reason = store.select("lastOpenChangeReason") as MenuRoot.ChangeEventReason | null;
    // One-shot emit: the values only steer this emit.
    untrack(() => {
      const eventDetails: MenuOpenEventDetails = { open, nodeId, parentNodeId, reason };
      floatingTreeRoot.events.emit("menuopenchange", eventDetails);
    });
  });

  const rootFloatingContext = untrack(() => store.select("floatingRootContext"));
  useTriggerSwitchTransition({
    store,
    domReference: () => rootFloatingContext.select("domReferenceElement") as Element | null,
    positionerElement: () => store.select("positionerElement") as HTMLElement | null,
    open: () => store.select("open") as boolean,
  });

  const compositeList = createCompositeList<{ label?: string | null }>();

  // Item refs can register while detached (and out of document order, e.g. a submenu trigger
  // behind wrapper components). Re-sort once attached so navigation follows the document.
  // One-shot: the effect subscribes to nothing, so it runs once after mount.
  effect(() => {
    untrack(() => compositeList.refresh());
  });

  // Mirrors the composite registry into the store refs that keyboard navigation
  // and typeahead consume.
  effect(() => {
    const map = compositeList.map();
    // One-shot sync write: the registry only steers this write.
    untrack(() => {
      const nextElements = Array.from<HTMLElement | null>({ length: map.size });
      const nextLabels = Array.from<string | null>({ length: map.size });
      for (const [element, entry] of map) {
        nextElements[entry.index] = element;
        nextLabels[entry.index] = entry.label ?? element.textContent ?? null;
      }
      store.context.itemDomElements.current = nextElements;
      store.context.itemLabels.current = nextLabels;
      // An index can come to point at a different element while its value stays the same.
      store.context.syncHighlightedItem?.();
    });
  });

  const isModalNonHover = () =>
    (store.select("modal") as boolean | undefined) === true &&
    (store.select("lastOpenChangeReason") as string | null) !== REASONS.triggerHover;

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

  function snapshot(): MenuPositionerState {
    return {
      open: store.select("open"),
      side: positioning.side(),
      align: positioning.align(),
      anchorHidden: positioning.anchorHidden(),
      nested: isSubmenu,
      instant: store.select("instantType"),
    };
  }

  const showInternalBackdrop = () => (store.select("mounted") as boolean) && !isSubmenu && isModalNonHover();

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const positionerContextValue = {
    side: positioning.side,
    align: positioning.align,
    arrowRef: positioning.arrowRef,
    arrowUncentered: positioning.arrowUncentered,
    arrowStyles: positioning.arrowStyles,
  };

  function ref(element: HTMLElement | null) {
    positioning.refs.setFloating(element);
    store.set("positionerElement", element);
    (props.ref as ((element: HTMLElement | null) => void) | undefined)?.(element);
  }

  // The providers live inside the tag: context does not flow through dynamicElement,
  // so providing above them would leave the positioner parts without context. Children
  // resolve in MenuPositionerContent below so they are created inside the providers.
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
        {showInternalBackdrop() && (
          <InternalBackdrop cutout={(store.select("activeTriggerElement") as Element | null) ?? undefined} />
        )}
        <FloatingNode id={floatingNodeId}>
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
            data-nested={isSubmenu ? "" : undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={mergeStyleValue(
              {
                ...positioning.positionerStyles(),
                ...(store.select("transitionStatus") === "starting" ? { transition: "none" } : null),
              } as Record<string, string | undefined>,
              resolveStyleValue(props.style, snapshot()),
            )}
            ref={ref}
          >
            <MenuPositionerContext value={positionerContextValue}>
              <CompositeListContext value={compositeList.contextValue}>
                <MenuPositionerContent
                  open={store.select("open") as boolean}
                  side={positioning.side()}
                  align={positioning.align()}
                  anchorHidden={positioning.anchorHidden()}
                  nested={isSubmenu}
                  instant={store.select("instantType")}
                >
                  {props.children}
                </MenuPositionerContent>
              </CompositeListContext>
            </MenuPositionerContext>
          </div>
        </FloatingNode>
      </>
    );
  }

  return (
    <>
      {showInternalBackdrop() && <InternalBackdrop cutout={(store.select("activeTriggerElement") as Element | null) ?? undefined} />}
      <FloatingNode id={floatingNodeId}>
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
          data-nested={isSubmenu ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={mergeStyleValue(
            {
              ...positioning.positionerStyles(),
              ...(store.select("transitionStatus") === "starting" ? { transition: "none" } : null),
            } as Record<string, string | undefined>,
            resolveStyleValue(props.style, snapshot()),
          )}
          ref={ref}
        >
          <MenuPositionerContext value={positionerContextValue}>
            <CompositeListContext value={compositeList.contextValue}>
              <MenuPositionerContent
                open={store.select("open") as boolean}
                side={positioning.side()}
                align={positioning.align()}
                anchorHidden={positioning.anchorHidden()}
                nested={isSubmenu}
                instant={store.select("instantType")}
              >
                {props.children}
              </MenuPositionerContent>
            </CompositeListContext>
          </MenuPositionerContext>
        </Tag>
      </FloatingNode>
    </>
  );
}

/**
 * Resolves the positioner children inside the positioner contexts exactly once, matching
 * the Solid layer where positioner children render untracked. Zero-argument functions pass
 * through untouched: Reze control-flow primitives return thunks, and invoking one here
 * would resolve the subtree one-shot instead of binding it.
 */
function MenuPositionerContent(props: {
  children: unknown;
  open: boolean;
  side: Side;
  align: Align;
  anchorHidden: boolean;
  nested: boolean;
  instant: string | undefined;
}) {
  const children = props.children;

  if (typeof children === "function" && (children as (...args: never[]) => unknown).length >= 1) {
    const render = children as (state: MenuPositionerState) => JSX.Element;
    // One-shot resolution: re-invoking the children function would recreate the
    // popup subtree and restart its transitions.
    return untrack(() =>
      render({
        open: props.open,
        side: props.side,
        align: props.align,
        anchorHidden: props.anchorHidden,
        nested: props.nested,
        instant: props.instant,
      }),
    );
  }

  return children as JSX.Element;
}

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

export type MenuPositionerProps<T extends JSX.ElementType = "div"> = MenuPositionerOwnProps & RebaseUIComponentProps<T, MenuPositionerState>;

export namespace MenuPositioner {
  export type State = MenuPositionerState;
  export type Props<T extends JSX.ElementType = "div"> = MenuPositionerProps<T>;
  export type OwnProps = MenuPositionerOwnProps;
}
