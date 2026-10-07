import { isElement } from "@floating-ui/utils/dom";
import { createEffect, untrack } from "solid-js";

import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import { stableCallback } from "../../stableCallback";
import { useFloatingTree } from "../tree/FloatingTree";
import type { FloatingTreeStore } from "../tree/FloatingTreeStore";
import type { Delay, FloatingContext, FloatingUIOpenChangeDetails, TriggerElementsMap } from "../types";
import { contains, getTarget } from "../utils/element";
import { isMouseLikePointerType } from "../utils/event";
import {
  applySafePolygonPointerEventsMutation,
  clearSafePolygonPointerEventsMutation,
  createHoverInteractionSharedState,
} from "./createHoverInteractionSharedState";
import type { HandleClose, HandleCloseContextBase } from "./createHoverShared";
import { getDelay, getRestMs, isClickLikeOpenEvent as isClickLikeOpenEventShared, isInsideEnabledTrigger } from "./createHoverShared";

export interface CreateHoverReferenceInteractionProps {
  /** Whether the interaction is enabled. Read once; not reactive. @default true */
  enabled?: boolean | undefined;
  /** Close handler (e.g. `safePolygon`). Read once. @default null */
  handleClose?: HandleClose | null | undefined;
  /** Cursor-rest delay (ms) before opening. Function form is evaluated per event. Read once. @default 0 */
  restMs?: number | (() => number) | undefined;
  /** Open/close delay (ms). Function form is evaluated per event. Read once. @default 0 */
  delay?: Delay | (() => Delay) | undefined;
  /** Whether a `mousemove` re-arms the open. Read once. @default true */
  move?: boolean | undefined;
  /** Whether only mouse input opens. Read once. @default false */
  mouseOnly?: boolean | undefined;
  /** External floating tree when context can't be used. Read once. */
  externalTree?: FloatingTreeStore | undefined;
  /** Whether this controls the active trigger. Read once. @default true */
  isActiveTrigger?: boolean | undefined;
  /** Explicit trigger element override. Read once. */
  triggerElementRef?: { readonly current: Element | null } | undefined;
  /** Lazy base context for `handleClose` when no floating context exists. Read once. */
  getHandleCloseContext?: (() => HandleCloseContextBase | null) | undefined;
  /** Whether the floating element is in a closing transition. Read once. */
  isClosing?: (() => boolean) | undefined;
  /** Veto for each hover-driven open attempt. Read once. */
  shouldOpen?: (() => boolean) | undefined;
  /** Cancel a pending hover-open on trigger `mouseout` (single-trigger hover roots only). Read once. @default false */
  guardStaleOpen?: boolean | undefined;
}

export interface HoverReferenceProps {
  onPointerDown: (event: PointerEvent) => void;
  onPointerEnter: (event: PointerEvent) => void;
  onMouseMove: (event: MouseEvent) => void;
}

// Runtime trigger registries (`PopupTriggerMap`) carry more than the minimal
// structural contract; the extras are optional here with `hasElement` fallback.
type TriggerRegistry = TriggerElementsMap & {
  hasMatchingElement?(predicate: (element: Element) => boolean): boolean;
  elements?(): IterableIterator<Element>;
};

function ownerDocument(node: Element | null | undefined): Document {
  return node?.ownerDocument ?? document;
}

function addListener(target: EventTarget, type: string, listener: (event: any) => void, options?: AddEventListenerOptions | boolean) {
  target.addEventListener(type, listener, options);
  return () => {
    target.removeEventListener(type, listener, options);
  };
}

function mergeCleanups(...cleanups: Array<(() => void) | false | undefined>) {
  return () => {
    for (const cleanup of cleanups) {
      if (cleanup) {
        cleanup();
      }
    }
  };
}

const EMPTY_TRIGGER_REF = { current: null } as { readonly current: Element | null };

/**
 * Hover interactions attached to reference or trigger elements.
 * Solid port of upstream `useHoverReferenceInteraction` (mui/base-ui v1.8.0,
 * includes the v1.8.0 hover fixes). Handlers receive native DOM events;
 * consumers spread the returned props onto a Solid element.
 */
export function createHoverReferenceInteraction(
  context: FloatingContext,
  props: CreateHoverReferenceInteractionProps = {},
): HoverReferenceProps | undefined {
  const store = context.rootStore;
  const { dataRef, events } = store.context;

  const enabled = untrack(() => props.enabled ?? true);
  const delay = untrack(() => props.delay ?? 0);
  const handleClose = untrack(() => props.handleClose ?? null);
  const mouseOnly = untrack(() => props.mouseOnly ?? false);
  const restMs = untrack(() => props.restMs ?? 0);
  const move = untrack(() => props.move ?? true);
  const triggerElementRef = untrack(() => props.triggerElementRef ?? EMPTY_TRIGGER_REF);
  const externalTree = untrack(() => props.externalTree);
  const isActiveTrigger = untrack(() => props.isActiveTrigger ?? true);
  const getHandleCloseContext = untrack(() => props.getHandleCloseContext);
  const isClosing = untrack(() => props.isClosing);
  const shouldOpenProp = untrack(() => props.shouldOpen);
  const guardStaleOpen = untrack(() => props.guardStaleOpen ?? false);

  const tree = useFloatingTree(externalTree);
  const instance = createHoverInteractionSharedState(store);
  const triggers = store.context.triggerElements as TriggerRegistry;

  let isHoverCloseActive = false;

  const isClickLikeOpenEvent = stableCallback(
    () => () => isClickLikeOpenEventShared(dataRef.current.openEvent?.type, instance.interactedInside),
  );

  const checkShouldOpen = stableCallback(() => () => shouldOpenProp?.() !== false);

  const isOverInactiveTrigger = stableCallback(
    () =>
      (currentDomReference: Element | null, currentTarget: Element, target: EventTarget | null): boolean => {
        // Fast path for handlers attached directly to triggers.
        if (triggers.hasElement(currentTarget)) {
          return !currentDomReference || !contains(currentDomReference, currentTarget);
        }

        // Fallback for delegated/wrapper usage where currentTarget is outside the trigger map.
        if (!isElement(target)) {
          return false;
        }

        const targetElement = target as Element;
        const hasMatching = triggers.hasMatchingElement
          ? triggers.hasMatchingElement((trigger) => contains(trigger, targetElement))
          : false;
        return hasMatching && (!currentDomReference || !contains(currentDomReference, targetElement));
      },
  );

  const cleanupMouseMoveHandler = stableCallback(() => () => {
    if (!instance.handler) {
      return;
    }

    const doc = ownerDocument(store.peek("domReferenceElement"));
    doc.removeEventListener("mousemove", instance.handler);
    instance.handler = undefined;
  });

  const clearPointerEvents = stableCallback(() => () => {
    clearSafePolygonPointerEventsMutation(instance);
  });

  if (isActiveTrigger) {
    // eslint-disable-next-line no-underscore-dangle
    instance.handleCloseOptions = handleClose?.__options;
  }

  createEffect(
    () => undefined,
    () => () => {
      cleanupMouseMoveHandler();
    },
  );

  // When closing before opening, clear the delay timeouts to cancel it.
  createEffect(
    () => undefined,
    () => {
      if (!enabled) {
        return undefined;
      }

      function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
        if (!details.open) {
          isHoverCloseActive = details.reason === REASONS.triggerHover;
          cleanupMouseMoveHandler();
          instance.openChangeTimeout.clear();
          instance.restTimeout.clear();
          instance.blockMouseMove = true;
          instance.restTimeoutPending = false;
        } else {
          isHoverCloseActive = false;
        }
      }

      events.on("openchange", onOpenChangeLocal);
      return () => {
        events.off("openchange", onOpenChangeLocal);
      };
    },
  );

  createEffect(
    () => ({
      open: store.select("open"),
      domReference: store.select("domReferenceElement"),
      explicitTrigger: triggerElementRef.current,
    }),
    ({ open, domReference, explicitTrigger }) => {
      // `domReference` is consumed below for trigger resolution (tracked via
      // the compute); `explicitTrigger` is a plain ref snapshot kept for parity.
      void explicitTrigger;
      if (!enabled) {
        return undefined;
      }

      function closeWithDelay(event: MouseEvent, runElseBranch = true) {
        const closeDelay = getDelay(delay, "close", instance.pointerType);
        if (closeDelay) {
          instance.openChangeTimeout.start(closeDelay, () => {
            store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
            tree?.events.emit("floating.closed", event);
          });
        } else if (runElseBranch) {
          instance.openChangeTimeout.clear();
          store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
          tree?.events.emit("floating.closed", event);
        }
      }

      function onMouseEnter(event: MouseEvent) {
        instance.openChangeTimeout.clear();
        instance.blockMouseMove = false;

        if (mouseOnly && !isMouseLikePointerType(instance.pointerType)) {
          return;
        }

        // Only rest delay is set; there's no fallback delay. Handled by `onMouseMove`.
        const restMsValue = getRestMs(restMs);
        const openDelay = getDelay(delay, "open", instance.pointerType);
        const eventTarget = getTarget(event);
        const currentTarget = (event.currentTarget as HTMLElement) ?? null;
        const currentDomReference = store.peek("domReferenceElement");
        let triggerNode = currentTarget;

        // Wrapper/delegated mode: resolve the actual trigger from the event target.
        if (isElement(eventTarget) && !triggers.hasElement(eventTarget as Element)) {
          const candidates = triggers.elements?.() ?? [];
          for (const triggerElement of candidates) {
            if (contains(triggerElement, eventTarget as Element)) {
              triggerNode = triggerElement as HTMLElement;
              break;
            }
          }
        }

        // Wrapper/delegated mode fallback: if the wrapper contains the active
        // trigger, treat this as re-entering that active trigger.
        if (
          isElement(currentTarget) &&
          isElement(currentDomReference) &&
          !triggers.hasElement(currentTarget as Element) &&
          contains(currentTarget as Element, currentDomReference)
        ) {
          triggerNode = currentDomReference as HTMLElement;
        }

        const isOverInactive = triggerNode == null ? false : isOverInactiveTrigger(currentDomReference, triggerNode, eventTarget);
        const isOpen = store.peek("open");
        const isInClosingTransition = isClosing?.() ?? store.peek("transitionStatus") === "ending";
        const isHoverCloseTransition = !isOpen && isInClosingTransition && isHoverCloseActive;
        const isReenteringSameTriggerDuringCloseTransition =
          !isOverInactive &&
          isElement(triggerNode) &&
          isElement(currentDomReference) &&
          contains(currentDomReference, triggerNode as Element) &&
          isHoverCloseTransition;
        const isRestOnlyDelay = restMsValue > 0 && !openDelay;
        const shouldOpenImmediately =
          (isOverInactive && (isOpen || isHoverCloseTransition)) || isReenteringSameTriggerDuringCloseTransition;

        const shouldOpen = !isOpen || isOverInactive;

        // Open immediately when moving between triggers while open, or during
        // a hover-driven close transition (including same-trigger re-entry).
        if (shouldOpenImmediately) {
          if (checkShouldOpen()) {
            store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, triggerNode ?? undefined));
          }
          return;
        }

        if (isRestOnlyDelay) {
          return;
        }

        if (openDelay) {
          instance.openChangeTimeout.start(openDelay, () => {
            if (shouldOpen && checkShouldOpen()) {
              store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, triggerNode ?? undefined));
            }
          });
        } else if (shouldOpen) {
          if (checkShouldOpen()) {
            store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, triggerNode ?? undefined));
          }
        }
      }

      function onMouseLeave(event: MouseEvent) {
        if (isClickLikeOpenEvent()) {
          clearPointerEvents();
          return;
        }

        cleanupMouseMoveHandler();

        const doc = ownerDocument(store.peek("domReferenceElement"));
        instance.restTimeout.clear();
        instance.restTimeoutPending = false;

        const handleCloseContextBase = dataRef.current.floatingContext ?? getHandleCloseContext?.();

        if (isInsideEnabledTrigger(event.relatedTarget, store.context.triggerElements)) {
          return;
        }

        if (handleClose && handleCloseContextBase) {
          if (!store.peek("open")) {
            instance.openChangeTimeout.clear();
          }

          const currentTrigger = triggerElementRef.current;

          instance.handler = handleClose({
            ...handleCloseContextBase,
            tree,
            x: event.clientX,
            y: event.clientY,
            onClose() {
              clearPointerEvents();
              cleanupMouseMoveHandler();
              if (enabled && !isClickLikeOpenEvent() && currentTrigger === store.peek("domReferenceElement")) {
                closeWithDelay(event, true);
              }
            },
          });

          doc.addEventListener("mousemove", instance.handler);
          instance.handler(event);

          return;
        }

        const shouldClose =
          instance.pointerType === "touch" ? !contains(store.peek("floatingElement"), event.relatedTarget as Element | null) : true;

        if (shouldClose) {
          closeWithDelay(event);
        }
      }

      // Backup cancellation for Chrome's dropped `mouseleave` — see `guardStaleOpen`.
      function onMouseOut(event: MouseEvent) {
        if (contains(trigger, event.relatedTarget as Element | null)) {
          return;
        }
        instance.openChangeTimeout.clear();
        instance.restTimeout.clear();
        instance.restTimeoutPending = false;
      }

      const trigger = (triggerElementRef.current as HTMLElement | null) ?? (isActiveTrigger ? (domReference as HTMLElement | null) : null);

      if (!isElement(trigger)) {
        return undefined;
      }

      const staleOpenGuard = guardStaleOpen ? addListener(trigger, "mouseout", onMouseOut) : undefined;

      if (move) {
        return mergeCleanups(
          open && addListener(trigger, "mousemove", onMouseEnter, { once: true }),
          addListener(trigger, "mouseenter", onMouseEnter),
          addListener(trigger, "mouseleave", onMouseLeave),
          staleOpenGuard,
        );
      }

      return mergeCleanups(
        addListener(trigger, "mouseenter", onMouseEnter),
        addListener(trigger, "mouseleave", onMouseLeave),
        staleOpenGuard,
      );
    },
  );

  if (!enabled) {
    return undefined;
  }

  function setPointerRef(event: PointerEvent) {
    instance.pointerType = event.pointerType;
  }

  // Rest-delay path: the native `mouseenter`/`mousemove` listeners above handle
  // the immediate and `delay` opens; insignificant cursor tremors are ignored.
  function onMouseMove(event: MouseEvent) {
    const trigger = event.currentTarget as HTMLElement;
    const nativeEvent = event;

    const currentDomReference = store.peek("domReferenceElement");
    const currentOpen = store.peek("open");
    const isOverInactive = isOverInactiveTrigger(currentDomReference, trigger, event.target);

    if (mouseOnly && !isMouseLikePointerType(instance.pointerType)) {
      return;
    }

    if (currentOpen && isOverInactive && instance.handleCloseOptions?.blockPointerEvents) {
      const floatingElement = store.peek("floatingElement");

      if (floatingElement) {
        const scopeElement = instance.handleCloseOptions?.getScope?.() ?? trigger.ownerDocument.body;

        applySafePolygonPointerEventsMutation(instance, {
          scopeElement,
          referenceElement: trigger,
          floatingElement,
        });
      }
    }

    const restMsValue = getRestMs(restMs);
    if ((currentOpen && !isOverInactive) || restMsValue === 0) {
      return;
    }

    if (!isOverInactive && instance.restTimeoutPending && event.movementX ** 2 + event.movementY ** 2 < 2) {
      return;
    }

    instance.restTimeout.clear();

    function handleMouseMove() {
      instance.restTimeoutPending = false;

      // A delayed hover open must not override a click-like open that happened
      // while the hover delay was pending.
      if (isClickLikeOpenEvent()) {
        return;
      }

      const latestOpen = store.peek("open");

      if (!instance.blockMouseMove && (!latestOpen || isOverInactive) && checkShouldOpen()) {
        store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, nativeEvent, trigger));
      }
    }

    if (instance.pointerType === "touch") {
      handleMouseMove();
    } else if (isOverInactive && currentOpen) {
      handleMouseMove();
    } else {
      instance.restTimeoutPending = true;
      instance.restTimeout.start(restMsValue, handleMouseMove);
    }
  }

  return {
    onPointerDown: setPointerRef,
    onPointerEnter: setPointerRef,
    onMouseMove,
  };
}
