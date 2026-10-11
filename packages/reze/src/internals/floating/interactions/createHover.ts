import { isElement } from "@floating-ui/utils/dom";
import { effect, onCleanup, untrack } from "reze-js";

import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import { useFloatingParentNodeId, useFloatingTree } from "../tree/FloatingTree";
import type { Delay, FloatingContext, FloatingUIOpenChangeDetails } from "../types";
import { contains, getTarget, isInteractiveElement } from "../utils/element";
import { Timeout } from "./createHoverInteractionSharedState";
import type { HandleClose } from "./createHoverShared";
import { getDelay, getRestMs, isClickLikeOpenEvent as isClickLikeOpenEventShared, isHoverOpenEvent } from "./createHoverShared";

export type { HandleCloseContext, HandleClose } from "./createHoverShared";

export interface CreateHoverProps {
  /** Close handler (e.g. `safePolygon`). Read once. @default null */
  handleClose?: HandleClose | null | undefined;
  /** Cursor-rest delay (ms) before opening. Function form is evaluated per event. Read once. @default 0 */
  restMs?: number | (() => number) | undefined;
  /** Open/close delay (ms). Function form is evaluated per event. Read once. @default 0 */
  delay?: Delay | (() => Delay) | undefined;
  /** Whether moving the cursor over the floating element opens it. Read once. @default true */
  move?: boolean | undefined;
}

export interface HoverReferenceProps {
  onPointerDown: (event: PointerEvent) => void;
  onPointerEnter: (event: PointerEvent) => void;
  onMouseMove: (event: MouseEvent) => void;
}

export interface CreateHoverResult {
  /** Getter returning props to spread onto the reference element. */
  reference: () => HoverReferenceProps;
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
 * Opens the floating element while hovering over the reference element, like
 * CSS `:hover`. Reze port of upstream `useHover` (mui/base-ui v1.8.0).
 * Handlers receive native DOM events; consumers spread `reference()` onto an
 * element.
 */
export function createHover(context: FloatingContext, props: CreateHoverProps = {}): CreateHoverResult {
  const store = context.rootStore;
  const { dataRef, events } = store.context;

  const delay = untrack(() => props.delay ?? 0);
  const handleClose = untrack(() => props.handleClose ?? null);
  const restMs = untrack(() => props.restMs ?? 0);
  const move = untrack(() => props.move ?? true);

  const tree = useFloatingTree();
  const parentId = useFloatingParentNodeId();

  let pointerType: string | undefined;
  let interactedInside = false;
  let handler: ((event: MouseEvent) => void) | undefined;
  let blockMouseMove = true;
  let performedPointerEventsMutation = false;
  let unbindMouseMove: () => void = () => {};
  let restTimeoutPending = false;

  const timeout = new Timeout();
  const restTimeout = new Timeout();

  function isHoverOpen() {
    return isHoverOpenEvent(dataRef.current.openEvent?.type);
  }

  function isClickLikeOpenEvent() {
    return isClickLikeOpenEventShared(dataRef.current.openEvent?.type, interactedInside);
  }

  function cleanupMouseMoveHandler() {
    unbindMouseMove();
    handler = undefined;
  }

  function clearPointerEvents() {
    if (performedPointerEventsMutation) {
      const body = ownerDocument(store.peek("floatingElement")).body;
      body.style.pointerEvents = "";
      performedPointerEventsMutation = false;
    }
  }

  // When closing before opening, clear the delay timeouts to cancel it.
  effect(() => {
    let cleanup: (() => void) | undefined;
    // One-shot subscription: no reactive reads, runs once for the owner.
    untrack(() => {
      function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
        if (!details.open) {
          timeout.clear();
          restTimeout.clear();
          blockMouseMove = true;
          restTimeoutPending = false;
        }
      }

      events.on("openchange", onOpenChangeLocal);
      cleanup = () => {
        events.off("openchange", onOpenChangeLocal);
      };
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  effect(() => {
    const open = store.select("open");
    const floating = store.select("floatingElement");
    let cleanup: (() => void) | undefined;
    // One-shot listener wiring: the values only steer the subscription.
    untrack(() => {
      if (!handleClose || !open) {
        return;
      }

      function onLeave(event: MouseEvent) {
        if (isClickLikeOpenEvent()) {
          return;
        }

        if (isHoverOpen()) {
          store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event, (event.currentTarget as HTMLElement) ?? undefined));
        }
      }

      const html = ownerDocument(floating).documentElement;
      cleanup = addListener(html, "mouseleave", onLeave);
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  // Registering the mouse events on the reference directly to bypass
  // delegation: if the cursor was on a disabled element and then entered the
  // reference (no gap), `mouseenter` doesn't fire in delegation systems.
  effect(() => {
    const domReference = store.select("domReferenceElement");
    const floating = store.select("floatingElement");
    const open = store.select("open");
    let cleanup: (() => void) | undefined;
    // One-shot listener wiring: the values only steer the subscriptions.
    untrack(() => {
      function closeWithDelay(event: MouseEvent, runElseBranch = true) {
        const closeDelay = getDelay(delay, "close", pointerType);
        if (closeDelay && !handler) {
          timeout.start(closeDelay, () => store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event)));
        } else if (runElseBranch) {
          timeout.clear();
          store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
        }
      }

      function handleInteractInside(event: PointerEvent) {
        const target = getTarget(event) as Element | null;
        if (!isInteractiveElement(target)) {
          interactedInside = false;
          return;
        }

        interactedInside = true;
      }

      function getHandleCloseHandler(event: MouseEvent, onClose: () => void) {
        if (!handleClose || !dataRef.current.floatingContext) {
          return null;
        }

        return handleClose({
          ...dataRef.current.floatingContext,
          tree,
          x: event.clientX,
          y: event.clientY,
          onClose,
        });
      }

      function onReferenceMouseEnter(event: MouseEvent) {
        timeout.clear();
        blockMouseMove = false;

        if (getRestMs(restMs) > 0 && !getDelay(delay, "open")) {
          return;
        }

        const openDelay = getDelay(delay, "open", pointerType);
        const trigger = (event.currentTarget as HTMLElement) ?? undefined;
        const domReferenceElement = store.peek("domReferenceElement");

        const isOverInactiveTrigger = domReferenceElement && trigger && !contains(domReferenceElement, trigger);

        if (openDelay) {
          timeout.start(openDelay, () => {
            if (!store.peek("open")) {
              store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
            }
          });
        } else if (!open || isOverInactiveTrigger) {
          store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
        }
      }

      function onReferenceMouseLeave(event: MouseEvent) {
        if (isClickLikeOpenEvent()) {
          clearPointerEvents();
          return;
        }

        unbindMouseMove();

        const doc = ownerDocument(floating);
        restTimeout.clear();
        restTimeoutPending = false;

        const triggers = store.context.triggerElements;

        if (event.relatedTarget && triggers.hasElement(event.relatedTarget as Element)) {
          return;
        }

        const handlerResult = getHandleCloseHandler(event, () => {
          clearPointerEvents();
          cleanupMouseMoveHandler();
          if (!isClickLikeOpenEvent()) {
            closeWithDelay(event, true);
          }
        });

        if (handlerResult) {
          // Prevent clearing `onScrollMouseLeave` timeout.
          if (!open) {
            timeout.clear();
          }

          handler = handlerResult;
          unbindMouseMove = addListener(doc, "mousemove", handler);

          return;
        }

        // Allow interactivity without `safePolygon` on touch devices. With a
        // pointer, a short close delay is an alternative, so it should work
        // consistently.
        const shouldClose = pointerType === "touch" ? !contains(floating, event.relatedTarget as Element | null) : true;
        if (shouldClose) {
          closeWithDelay(event);
        }
      }

      // Ensure the floating element closes after scrolling even if the pointer
      // did not move. https://github.com/floating-ui/floating-ui/discussions/1692
      function onScrollMouseLeave(event: MouseEvent) {
        if (isClickLikeOpenEvent() || !dataRef.current.floatingContext || !store.peek("open")) {
          return;
        }

        const triggers = store.context.triggerElements;

        if (event.relatedTarget && triggers.hasElement(event.relatedTarget as Element)) {
          return;
        }

        getHandleCloseHandler(event, () => {
          clearPointerEvents();
          cleanupMouseMoveHandler();
          if (!isClickLikeOpenEvent()) {
            closeWithDelay(event);
          }
        })?.(event);
      }

      function onFloatingMouseEnter() {
        timeout.clear();
        clearPointerEvents();
      }

      function onFloatingMouseLeave(event: MouseEvent) {
        if (!isClickLikeOpenEvent()) {
          closeWithDelay(event, false);
        }
      }

      const trigger = domReference as HTMLElement | null;

      if (isElement(trigger)) {
        cleanup = mergeCleanups(
          open && addListener(trigger, "mouseleave", onScrollMouseLeave),
          move && addListener(trigger, "mousemove", onReferenceMouseEnter, { once: true }),
          addListener(trigger, "mouseenter", onReferenceMouseEnter),
          addListener(trigger, "mouseleave", onReferenceMouseLeave),
          floating && addListener(floating, "mouseleave", onScrollMouseLeave),
          floating && addListener(floating, "mouseenter", onFloatingMouseEnter),
          floating && addListener(floating, "mouseleave", onFloatingMouseLeave),
          floating && addListener(floating, "pointerdown", handleInteractInside, true),
        );
      }
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  // Block pointer-events of every element other than the reference and floating
  // while open with a `handleClose` that requests it. Handles nested floating
  // elements. https://github.com/floating-ui/floating-ui/issues/1722
  effect(() => {
    const open = store.select("open");
    const domReference = store.select("domReferenceElement");
    const floating = store.select("floatingElement");
    let cleanup: (() => void) | undefined;
    // One-shot style mutation: the values only steer the mutation.
    untrack(() => {
      // eslint-disable-next-line no-underscore-dangle
      if (open && handleClose?.__options?.blockPointerEvents && isHoverOpen()) {
        performedPointerEventsMutation = true;

        if (isElement(domReference) && floating) {
          const body = ownerDocument(floating).body;
          const ref = domReference as HTMLElement | SVGSVGElement;

          const parentFloating = tree?.nodesRef.current.find((node) => node.id === parentId)?.context?.elements.floating;

          if (parentFloating) {
            parentFloating.style.pointerEvents = "";
          }

          body.style.pointerEvents = "none";
          ref.style.pointerEvents = "auto";
          floating.style.pointerEvents = "auto";

          cleanup = () => {
            body.style.pointerEvents = "";
            ref.style.pointerEvents = "";
            floating.style.pointerEvents = "";
          };
        }
      }
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  effect(() => {
    const open = store.select("open");
    // One-shot flag resets: the value only steers the resets.
    untrack(() => {
      if (!open) {
        pointerType = undefined;
        restTimeoutPending = false;
        interactedInside = false;
        cleanupMouseMoveHandler();
        clearPointerEvents();
      }
    });
  });

  effect(() => {
    store.select("domReferenceElement");
    onCleanup(() => {
      cleanupMouseMoveHandler();
      timeout.clear();
      restTimeout.clear();
      clearPointerEvents();
      interactedInside = false;
    });
  });

  const referenceProps: HoverReferenceProps = {
    onPointerDown(event) {
      pointerType = event.pointerType;
    },
    onPointerEnter(event) {
      pointerType = event.pointerType;
    },
    onMouseMove(event) {
      const trigger = event.currentTarget as HTMLElement;

      // `true` when hovering the trigger that wasn't used to open the floating
      // element with multiple triggers per floating element.
      const currentDomReference = store.peek("domReferenceElement");
      const isOverInactiveTrigger = currentDomReference && !contains(currentDomReference, event.target as Element);

      function handleMouseMove() {
        if (!blockMouseMove && (!store.peek("open") || isOverInactiveTrigger)) {
          store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, trigger));
        }
      }

      if ((store.peek("open") && !isOverInactiveTrigger) || getRestMs(restMs) === 0) {
        return;
      }

      // Ignore insignificant movements to account for tremors.
      if (!isOverInactiveTrigger && restTimeoutPending && event.movementX ** 2 + event.movementY ** 2 < 2) {
        return;
      }

      restTimeout.clear();

      if (pointerType === "touch") {
        handleMouseMove();
      } else if (isOverInactiveTrigger) {
        handleMouseMove();
      } else {
        restTimeoutPending = true;
        restTimeout.start(getRestMs(restMs), handleMouseMove);
      }
    },
  };

  const reference = () => referenceProps;

  return { reference };
}
