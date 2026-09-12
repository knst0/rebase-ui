import { isElement } from "@floating-ui/utils/dom";
import { createEffect, untrack } from "solid-js";

import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import { stableCallback } from "../../stableCallback";
import { useFloatingParentNodeId, useFloatingTree } from "../tree/FloatingTree";
import type { FloatingContext } from "../types";
import { contains, getTarget, isInteractiveElement } from "../utils/element";
import { getNodeChildren } from "../utils/nodes";
import {
  applySafePolygonPointerEventsMutation,
  clearSafePolygonPointerEventsMutation,
  createHoverInteractionSharedState,
  Timeout,
} from "./createHoverInteractionSharedState";
import {
  getDelay,
  isClickLikeOpenEvent as isClickLikeOpenEventShared,
  isHoverOpenEvent,
  isInsideEnabledTrigger,
} from "./createHoverShared";

export interface CreateHoverFloatingInteractionProps {
  /** Whether the interaction is enabled. Read once; not reactive. @default true */
  enabled?: boolean | undefined;
  /** Close delay (ms). Function form is evaluated per event. Read once. @default 0 */
  closeDelay?: number | (() => number) | undefined;
  /** Tree node id override for floating elements without a `FloatingContext`. Read once. */
  nodeId?: string | undefined;
}

function ownerDocument(node: Element | null | undefined): Document {
  return node?.ownerDocument ?? document;
}

function addListener(target: EventTarget, type: string, listener: (event: any) => void, options?: AddEventListenerOptions | boolean) {
  target.addEventListener(type, listener, options);
  return () => {
    target.removeEventListener(type, listener, options);
  };
}

function mergeCleanups(...cleanups: Array<(() => void) | false | null | undefined>) {
  return () => {
    for (const cleanup of cleanups) {
      if (cleanup) {
        cleanup();
      }
    }
  };
}

/**
 * Hover interactions attached to the floating element.
 * Solid port of upstream `useHoverFloatingInteraction` (mui/base-ui v1.8.0).
 */
export function createHoverFloatingInteraction(context: FloatingContext, props: CreateHoverFloatingInteractionProps = {}): void {
  const store = context.rootStore;
  const { dataRef } = store.context;

  const enabled = untrack(() => props.enabled ?? true);
  const closeDelayProp = untrack(() => props.closeDelay ?? 0);
  const nodeIdProp = untrack(() => props.nodeId);

  const tree = useFloatingTree();
  const parentId = useFloatingParentNodeId();
  const instance = createHoverInteractionSharedState(store);

  const childClosedTimeout = new Timeout();

  const isClickLikeOpenEvent = stableCallback(
    () => () => isClickLikeOpenEventShared(dataRef.current.openEvent?.type, instance.interactedInside),
  );

  const isHoverOpen = stableCallback(() => () => isHoverOpenEvent(dataRef.current.openEvent?.type));

  const clearPointerEvents = stableCallback(() => () => {
    clearSafePolygonPointerEventsMutation(instance);
  });

  createEffect(
    () => store.select("open"),
    (open) => {
      if (!open) {
        instance.pointerType = undefined;
        instance.restTimeoutPending = false;
        instance.interactedInside = false;
        clearPointerEvents();
      }
    },
  );

  createEffect(
    () => undefined,
    () => () => {
      clearPointerEvents();
      childClosedTimeout.clear();
    },
  );

  // Block pointer-events of every element other than the reference and
  // floating while open with a `handleClose` that requests it. Handles nested
  // floating elements. https://github.com/floating-ui/floating-ui/issues/1722
  createEffect(
    () => ({
      open: store.select("open"),
      domReference: store.select("domReferenceElement"),
      floating: store.select("floatingElement"),
    }),
    ({ open, domReference, floating }) => {
      if (!enabled) {
        return undefined;
      }

      if (open && instance.handleCloseOptions?.blockPointerEvents && isHoverOpen() && isElement(domReference) && floating) {
        const ref = domReference as HTMLElement | SVGSVGElement;
        const floatingEl = floating;
        const doc = ownerDocument(floating);

        const parentFloating = tree?.nodesRef.current.find((node) => node.id === parentId)?.context?.elements
          .floating as HTMLElement | null;

        if (parentFloating) {
          parentFloating.style.pointerEvents = "";
        }

        // A keep-mounted submenu can appear in the tree before it opens, so a
        // cached scope or parent lookup may resolve to the submenu itself.
        const cachedScopeElement = instance.pointerEventsScopeElement !== floatingEl ? instance.pointerEventsScopeElement : null;
        const parentScopeElement = parentFloating !== floatingEl ? parentFloating : null;
        const scopeElement =
          instance.handleCloseOptions?.getScope?.() ??
          cachedScopeElement ??
          parentScopeElement ??
          (ref.closest("[data-rootownerid]") as HTMLElement | SVGSVGElement | null) ??
          doc.body;

        applySafePolygonPointerEventsMutation(instance, {
          scopeElement,
          referenceElement: ref,
          floatingElement: floatingEl,
        });

        return () => {
          clearPointerEvents();
        };
      }

      return undefined;
    },
  );

  createEffect(
    () => store.select("floatingElement"),
    (floatingElement) => {
      if (!enabled) {
        return undefined;
      }

      function hasParentChildren() {
        return !!(tree && parentId && getNodeChildren(tree.nodesRef.current, parentId).length > 0);
      }

      function closeWithDelay(event: MouseEvent) {
        const closeDelay = getDelay(closeDelayProp, "close", instance.pointerType);
        const close = () => {
          store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
          tree?.events.emit("floating.closed", event);
        };

        if (closeDelay) {
          instance.openChangeTimeout.start(closeDelay, close);
        } else {
          instance.openChangeTimeout.clear();
          close();
        }
      }

      function handleInteractInside(event: PointerEvent) {
        const target = getTarget(event) as Element | null;
        if (!isInteractiveElement(target)) {
          instance.interactedInside = false;
          return;
        }

        instance.interactedInside = target?.closest("[aria-haspopup]") != null;
      }

      function onFloatingMouseEnter() {
        instance.openChangeTimeout.clear();
        childClosedTimeout.clear();
        tree?.events.off("floating.closed", onNodeClosed);
        clearPointerEvents();
      }

      function onFloatingMouseLeave(event: MouseEvent) {
        if (hasParentChildren() && tree) {
          tree.events.on("floating.closed", onNodeClosed);
          return;
        }

        if (isInsideEnabledTrigger(event.relatedTarget, store.context.triggerElements)) {
          return;
        }

        const currentNodeId = dataRef.current.floatingContext?.nodeId ?? nodeIdProp;
        const relatedTarget = event.relatedTarget;
        const isMovingIntoDescendantFloating =
          tree &&
          currentNodeId &&
          isElement(relatedTarget) &&
          getNodeChildren(tree.nodesRef.current, currentNodeId, false).some((node) =>
            contains(node.context?.elements.floating, relatedTarget as Element),
          );

        if (isMovingIntoDescendantFloating) {
          return;
        }

        // If the safePolygon handler is active, let it handle the close logic.
        if (instance.handler) {
          instance.handler(event);
          return;
        }

        clearPointerEvents();
        if (isHoverOpen() && !isClickLikeOpenEvent()) {
          closeWithDelay(event);
        }
      }

      function onNodeClosed(event: MouseEvent) {
        if (!tree || !parentId || hasParentChildren()) {
          return;
        }
        // Allow the mouseenter event to fire in case child was closed because
        // mouse moved into parent.
        childClosedTimeout.start(0, () => {
          tree.events.off("floating.closed", onNodeClosed);
          store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
          tree.events.emit("floating.closed", event);
        });
      }

      const floating = floatingElement;
      return mergeCleanups(
        floating && addListener(floating, "mouseenter", onFloatingMouseEnter),
        floating && addListener(floating, "mouseleave", onFloatingMouseLeave),
        floating && addListener(floating, "pointerdown", handleInteractInside, true),
        () => {
          tree?.events.off("floating.closed", onNodeClosed);
        },
      );
    },
  );
}
