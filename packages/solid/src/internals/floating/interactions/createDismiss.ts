import { getComputedStyle, getParentNode, isElement, isHTMLElement, isLastTraversableNode, isShadowRoot } from "@floating-ui/utils/dom";
import { createEffect, untrack } from "solid-js";

import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import { stableCallback } from "../../stableCallback";
import { useFloatingTree } from "../tree/FloatingTree";
import type { FloatingTreeStore } from "../tree/FloatingTreeStore";
import type { FloatingContext, FloatingUIOpenChangeDetails } from "../types";
import { createAttribute } from "../utils/createAttribute";
import { contains, getTarget, isEventTargetWithin, isRootElement } from "../utils/element";
import { isVirtualClick } from "../utils/event";
import { getNodeChildren } from "../utils/nodes";

type PressType = "intentional" | "sloppy";

export function normalizeProp(normalizable?: boolean | { escapeKey?: boolean | undefined; outsidePress?: boolean | undefined }) {
  return {
    escapeKey: typeof normalizable === "boolean" ? normalizable : (normalizable?.escapeKey ?? false),
    outsidePress: typeof normalizable === "boolean" ? normalizable : (normalizable?.outsidePress ?? true),
  };
}

export interface CreateDismissProps {
  /** Whether the interaction is enabled. Read once; not reactive. @default true */
  enabled?: boolean | undefined;
  /** Whether to dismiss upon pressing `esc`. Read once. @default true */
  escapeKey?: boolean | undefined;
  /** Lazy getter invoked on reference press events. Read once. @default () => false */
  referencePress?: (() => boolean) | undefined;
  /** Whether to dismiss upon pressing outside. Function form is a lazy per-event guard. Read once. @default true */
  outsidePress?: boolean | ((event: MouseEvent | TouchEvent) => boolean) | undefined;
  /** Which press model counts as an outside press. Function form is lazy. Read once. @default 'sloppy' */
  outsidePressEvent?:
    | PressType
    | { mouse: PressType; touch: PressType }
    | (() => PressType | { mouse: PressType; touch: PressType })
    | undefined;
  /** Whether dismissal bubbles through nested floating elements. Read once. */
  bubbles?: boolean | { escapeKey?: boolean | undefined; outsidePress?: boolean | undefined } | undefined;
  /** External floating tree when context can't be used. Read once. */
  externalTree?: FloatingTreeStore | undefined;
}

export interface DismissReferenceProps {
  onKeyDown: (event: KeyboardEvent) => void;
  onPointerDown: (event: PointerEvent | MouseEvent) => void;
  onClick: (event: PointerEvent | MouseEvent) => void;
}

export interface DismissFloatingProps {
  onKeyDown: (event: KeyboardEvent) => void;
  onPointerDown: (event: PointerEvent | MouseEvent) => void;
  onMouseDown: (event: PointerEvent | MouseEvent) => void;
}

export interface CreateDismissResult {
  /** Getter returning props to spread onto the Solid reference element. */
  reference: () => DismissReferenceProps;
  /** Getter returning props to spread onto the Solid floating element. */
  floating: () => DismissFloatingProps;
}

function ownerDocument(node: Element | null | undefined): Document {
  return node?.ownerDocument ?? document;
}

function addListener(target: EventTarget, type: string, listener: (event: any) => void, options?: AddEventListenerOptions) {
  target.addEventListener(type, listener, options);
  return () => {
    target.removeEventListener(type, listener, options);
  };
}

/**
 * Closes the floating element on dismissal — by default `esc` or an outside press.
 * Solid port of upstream `useDismiss` (mui/base-ui v1.8.0).
 *
 * Includes the v1.8.0 outside-press timing guard: document listeners only attach
 * while open, so a press that started before the floating element opened never
 * marks `sawPressWhileOpen`, and its trailing `click` is ignored in
 * `intentional` mode. Touch `sloppy` mode dismisses on `touchend` (within 1s)
 * or while scrolling away after `touchstart`.
 *
 * Capture-phase floating listeners (`markInsideReactTree` family) are attached
 * imperatively to the store's floating element instead of returned props, so the
 * one-shot target listener registered by the document capture handler observes
 * them in the correct phase order. Consumers spread `reference()`/`floating()`.
 */
export function createDismiss(context: FloatingContext, props: CreateDismissProps = {}): CreateDismissResult {
  const store = context.rootStore;
  const { dataRef, events } = store.context;

  const enabled = untrack(() => props.enabled ?? true);
  const escapeKey = untrack(() => props.escapeKey ?? true);
  const outsidePressProp = untrack(() => props.outsidePress ?? true);
  const outsidePressEvent = untrack(() => props.outsidePressEvent ?? "sloppy");
  const referencePress = untrack(() => props.referencePress ?? (() => false));
  const bubbles = untrack(() => props.bubbles);
  const externalTree = untrack(() => props.externalTree);

  const tree = useFloatingTree(externalTree);
  const outsidePressFn = stableCallback(() => (typeof outsidePressProp === "function" ? outsidePressProp : undefined));
  const outsidePress = typeof outsidePressProp === "function" ? outsidePressFn : outsidePressProp;
  const outsidePressEnabled = outsidePress !== false;
  const getOutsidePressEventProp = () => outsidePressEvent;

  const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp(bubbles);

  let pressStartedInside = false;
  let pressStartPrevented = false;
  let suppressNextOutsideClick = false;
  // A click whose press began before the floating element opened is the tail of
  // that gesture (e.g. the drag-release that opened it), not a new outside press.
  let sawPressWhileOpen = false;
  let isComposing = false;
  let currentPointerType = "" as PointerEvent["pointerType"];

  let touchState: {
    startTime: number;
    startX: number;
    startY: number;
    dismissOnTouchEnd: boolean;
    dismissOnMouseDown: boolean;
  } | null = null;

  let cancelDismissOnEndTimer: ReturnType<typeof setTimeout> | undefined;
  let clearInsideReactTreeTimer: ReturnType<typeof setTimeout> | undefined;
  let compositionTimer: ReturnType<typeof setTimeout> | undefined;
  let preventedPressSuppressionTimer: ReturnType<typeof setTimeout> | undefined;

  function clearAllTimers() {
    clearTimeout(cancelDismissOnEndTimer);
    clearTimeout(clearInsideReactTreeTimer);
    clearTimeout(compositionTimer);
    clearTimeout(preventedPressSuppressionTimer);
  }

  // Clear pending timers when the interaction owner disposes.
  createEffect(
    () => undefined,
    () => () => {
      clearAllTimers();
    },
  );

  const clearInsideReactTree = stableCallback(() => () => {
    clearTimeout(clearInsideReactTreeTimer);
    dataRef.current.insideReactTree = false;
  });

  const hasBlockingChild = stableCallback(() => (bubbleKey: "__escapeKeyBubbles" | "__outsidePressBubbles") => {
    const nodeId = dataRef.current.floatingContext?.nodeId;
    const children = tree ? getNodeChildren(tree.nodesRef.current, nodeId) : [];
    return children.some((child) => child.context?.open && !child.context.dataRef.current[bubbleKey]);
  });

  const isEventWithinOwnElements = stableCallback(() => (event: Event) => {
    return isEventTargetWithin(event, store.select("floatingElement")) || isEventTargetWithin(event, store.select("domReferenceElement"));
  });

  const closeOnReferencePress = stableCallback(() => (event: PointerEvent | MouseEvent) => {
    if (!referencePress()) {
      return;
    }

    store.setOpen(false, createChangeEventDetails(REASONS.triggerPress, event));
  });

  const closeOnEscapeKeyDown = stableCallback(() => (event: KeyboardEvent) => {
    if (!store.select("open") || !enabled || !escapeKey || event.key !== "Escape") {
      return;
    }

    // Wait until IME is settled. Pressing `Escape` while composing should
    // close the compose menu, but not the floating element.
    if (isComposing) {
      return;
    }

    if (!escapeKeyBubbles && hasBlockingChild("__escapeKeyBubbles")) {
      return;
    }

    const eventDetails = createChangeEventDetails(REASONS.escapeKey, event);
    store.setOpen(false, eventDetails);

    if (!eventDetails.isCanceled) {
      event.preventDefault();
    }

    if (!escapeKeyBubbles && !eventDetails.isPropagationAllowed) {
      event.stopPropagation();
    }
  });

  const markInsideReactTree = stableCallback(() => () => {
    dataRef.current.insideReactTree = true;
    clearTimeout(clearInsideReactTreeTimer);
    clearInsideReactTreeTimer = setTimeout(clearInsideReactTree, 0);
  });

  const markPressStartedInsideReactTree = stableCallback(() => (event: PointerEvent | MouseEvent) => {
    if (!store.select("open") || !enabled || event.button !== 0) {
      return;
    }

    const target = getTarget(event) as Element | null;

    // Only treat presses that start within the floating DOM subtree as inside.
    // This avoids suppressing parent dismissal when interacting with nested portals.
    if (!contains(store.select("floatingElement"), target)) {
      return;
    }

    if (!pressStartedInside) {
      pressStartedInside = true;
      pressStartPrevented = false;
    }
  });

  const markInsidePressStartPrevented = stableCallback(() => (event: PointerEvent | MouseEvent) => {
    if (!store.select("open") || !enabled) {
      return;
    }

    if (!event.defaultPrevented) {
      return;
    }

    if (pressStartedInside) {
      pressStartPrevented = true;
    }
  });

  // A same-batch close+reopen never renders `open === false`, so only
  // `openchange` can observe that session boundary. Covers controlled flips.
  createEffect(
    () => undefined,
    () => {
      function handleOpenChange(details: FloatingUIOpenChangeDetails) {
        // Only the closing half ends the session: `setOpen(true)` on an
        // already-open element must not drop a press mid-gesture.
        if (!details.open) {
          sawPressWhileOpen = false;
        }
      }

      events.on("openchange", handleOpenChange);
      return () => {
        events.off("openchange", handleOpenChange);
      };
    },
  );

  // Document listeners attach only while open. This is the timing guard: a
  // press that started before the floating element opened never marks
  // `sawPressWhileOpen`, so its trailing click is ignored in `intentional`
  // mode instead of immediately dismissing the just-opened element.
  createEffect(
    () => ({ open: store.select("open"), floating: store.select("floatingElement") }),
    ({ open, floating }) => {
      if (!open || !enabled) {
        // Reset in the effect body, not the cleanup, which also runs when a
        // dependency changes mid-gesture.
        if (!open) {
          sawPressWhileOpen = false;
        }
        return clearInsideReactTree;
      }

      dataRef.current.__escapeKeyBubbles = escapeKeyBubbles;
      dataRef.current.__outsidePressBubbles = outsidePressBubbles;

      const doc = ownerDocument(floating);

      function handleCompositionStart() {
        clearTimeout(compositionTimer);
        isComposing = true;
      }

      function handleCompositionEnd() {
        // Safari fires `compositionend` before `keydown`, so wait until the
        // next tick. Only WebKit needs the 5ms delay; tests stay at 0ms.
        const isWebKit = typeof navigator !== "undefined" && /applewebkit/i.test(navigator.userAgent ?? "");
        clearTimeout(compositionTimer);
        compositionTimer = setTimeout(
          () => {
            isComposing = false;
          },
          isWebKit ? 5 : 0,
        );
      }

      function suppressImmediateOutsideClickAfterPreventedStart() {
        suppressNextOutsideClick = true;
        // Firefox can emit the synthetic outside click in a later task after
        // pointer lock exit, so microtask clearing is too early here.
        clearTimeout(preventedPressSuppressionTimer);
        preventedPressSuppressionTimer = setTimeout(() => {
          suppressNextOutsideClick = false;
        }, 0);
      }

      function resetPressStartState() {
        pressStartedInside = false;
        pressStartPrevented = false;
      }

      function getOutsidePressEvent(): PressType {
        const type = currentPointerType as "pen" | "mouse" | "touch" | "";
        const computedType: "mouse" | "touch" = type === "pen" || !type ? "mouse" : type;

        const value = getOutsidePressEventProp();
        const resolved = typeof value === "function" ? value() : value;

        if (typeof resolved === "string") {
          return resolved;
        }

        return resolved[computedType];
      }

      function shouldIgnoreEvent(event: Event) {
        const computedOutsidePressEvent = getOutsidePressEvent();
        return (
          (computedOutsidePressEvent === "intentional" && event.type !== "click") ||
          (computedOutsidePressEvent === "sloppy" && event.type === "click")
        );
      }

      function isEventWithinFloatingTree(event: Event) {
        const nodeId = dataRef.current.floatingContext?.nodeId;
        const targetIsInsideChildren =
          tree &&
          getNodeChildren(tree.nodesRef.current, nodeId).some((node) => isEventTargetWithin(event, node.context?.elements.floating));

        return isEventWithinOwnElements(event) || targetIsInsideChildren;
      }

      function triggersHasElement(target: Element | null) {
        const triggers = store.context.triggerElements;
        if (!target) {
          return false;
        }
        if (triggers.hasElement(target)) {
          return true;
        }
        for (const [, trigger] of triggers.entries()) {
          if (contains(trigger, target)) {
            return true;
          }
        }
        return false;
      }

      function closeOnPressOutside(event: MouseEvent | PointerEvent | TouchEvent) {
        if (shouldIgnoreEvent(event)) {
          // A new press began outside. Clear leftover drag-out suppression so
          // this press's eventual click can dismiss.
          if (event.type !== "click" && !isEventWithinOwnElements(event)) {
            clearTimeout(preventedPressSuppressionTimer);
            suppressNextOutsideClick = false;
          }
          clearInsideReactTree();
          return;
        }

        if (dataRef.current.insideReactTree) {
          clearInsideReactTree();
          return;
        }

        const target = getTarget(event);
        const inertSelector = `[${createAttribute("inert")}]`;
        const targetRoot = isElement(target) ? (target as Element).getRootNode() : null;
        const scope = isShadowRoot(targetRoot) ? targetRoot : ownerDocument(store.select("floatingElement"));
        const markers = Array.from(scope.querySelectorAll(inertSelector));

        // If another trigger is pressed, don't close the floating element.
        if (triggersHasElement(target as Element | null)) {
          return;
        }

        let targetRootAncestor = isElement(target) ? (target as Element) : null;
        while (targetRootAncestor && !isLastTraversableNode(targetRootAncestor)) {
          const nextParent = getParentNode(targetRootAncestor);
          if (isLastTraversableNode(nextParent) || !isElement(nextParent)) {
            break;
          }
          targetRootAncestor = nextParent;
        }

        // Ignore presses on third-party elements injected after the floating
        // element rendered (their root contains none of the inert markers).
        if (
          markers.length &&
          isElement(target) &&
          !isRootElement(target as Element) &&
          !contains(target as Element, store.select("floatingElement")) &&
          markers.every((marker) => !contains(targetRootAncestor, marker))
        ) {
          return;
        }

        // Ignore presses on scrollbars (touch scrollbars receive no events).
        if (isHTMLElement(target) && !("touches" in event)) {
          const targetElement = target as HTMLElement;
          const lastTraversableNode = isLastTraversableNode(targetElement);
          const style = getComputedStyle(targetElement);
          const scrollRe = /auto|scroll/;
          const isScrollableX = lastTraversableNode || scrollRe.test(style.overflowX);
          const isScrollableY = lastTraversableNode || scrollRe.test(style.overflowY);

          const canScrollX = isScrollableX && targetElement.clientWidth > 0 && targetElement.scrollWidth > targetElement.clientWidth;
          const canScrollY = isScrollableY && targetElement.clientHeight > 0 && targetElement.scrollHeight > targetElement.clientHeight;

          const isRTL = style.direction === "rtl";

          const pressedVerticalScrollbar =
            canScrollY &&
            (isRTL
              ? (event as MouseEvent).offsetX <= targetElement.offsetWidth - targetElement.clientWidth
              : (event as MouseEvent).offsetX > targetElement.clientWidth);

          const pressedHorizontalScrollbar = canScrollX && (event as MouseEvent).offsetY > targetElement.clientHeight;

          if (pressedVerticalScrollbar || pressedHorizontalScrollbar) {
            return;
          }
        }

        if (isEventWithinFloatingTree(event)) {
          return;
        }

        // Only `click` events reach this point in intentional mode.
        if (getOutsidePressEvent() === "intentional") {
          // Press-less clicks (keyboard, assistive technology, `.click()`)
          // report no click count; `isVirtualClick` also catches the ones
          // that do. Otherwise require a press that started while open.
          if ((event as MouseEvent).detail !== 0 && !isVirtualClick(event as MouseEvent) && !sawPressWhileOpen) {
            return;
          }

          // A press that starts inside and ends outside gets one suppressed
          // outside click. Run this after inside-target checks so inside
          // clicks don't consume the one-shot suppression.
          if (suppressNextOutsideClick) {
            clearTimeout(preventedPressSuppressionTimer);
            suppressNextOutsideClick = false;
            return;
          }
        }

        if (typeof outsidePress === "function" && !outsidePress(event)) {
          return;
        }

        if (hasBlockingChild("__outsidePressBubbles")) {
          return;
        }

        store.setOpen(false, createChangeEventDetails(REASONS.outsidePress, event));
        clearInsideReactTree();
      }

      function handlePointerDown(event: PointerEvent) {
        if (
          getOutsidePressEvent() !== "sloppy" ||
          event.pointerType === "touch" ||
          !store.select("open") ||
          !enabled ||
          isEventWithinOwnElements(event)
        ) {
          return;
        }

        closeOnPressOutside(event);
      }

      function handleTouchStart(event: TouchEvent) {
        if (getOutsidePressEvent() !== "sloppy" || !store.select("open") || !enabled || isEventWithinOwnElements(event)) {
          return;
        }

        const touch = event.touches[0];
        if (touch) {
          touchState = {
            startTime: Date.now(),
            startX: touch.clientX,
            startY: touch.clientY,
            dismissOnTouchEnd: false,
            dismissOnMouseDown: true,
          };

          clearTimeout(cancelDismissOnEndTimer);
          cancelDismissOnEndTimer = setTimeout(() => {
            if (touchState) {
              touchState.dismissOnTouchEnd = false;
              touchState.dismissOnMouseDown = false;
            }
          }, 1000);
        }
      }

      function addTargetEventListenerOnce<EventType extends Event>(event: EventType, listener: (event: EventType) => void) {
        const target = getTarget(event);

        if (!target) {
          return;
        }

        const unsubscribe = addListener(target, event.type, () => {
          listener(event);
          unsubscribe();
        });
      }

      function handleTouchStartCapture(event: TouchEvent) {
        currentPointerType = "touch";
        addTargetEventListenerOnce(event, handleTouchStart);
      }

      function closeOnPressOutsideCapture(event: PointerEvent | MouseEvent) {
        clearTimeout(cancelDismissOnEndTimer);

        // Only `pointerdown` marks a press; `mousedown` is its compatibility
        // event, and counting it would misattribute a gesture that started
        // before open.
        if (event.type === "pointerdown") {
          // Only a primary press can produce a `click`.
          if (event.button === 0) {
            sawPressWhileOpen = true;
          }
          currentPointerType = (event as PointerEvent).pointerType;
        }

        if (event.type === "mousedown" && touchState && !touchState.dismissOnMouseDown) {
          return;
        }

        addTargetEventListenerOnce(event, (targetEvent) => {
          if (targetEvent.type === "pointerdown") {
            handlePointerDown(targetEvent as PointerEvent);
          } else {
            closeOnPressOutside(targetEvent as MouseEvent);
          }
        });
      }

      function handlePressEndCapture(event: PointerEvent | MouseEvent) {
        // A cancelled gesture produces no click. Not cleared on `pointerup`:
        // the click fires after it and must still find the press.
        if (event.type === "pointercancel") {
          sawPressWhileOpen = false;
        }

        if (!pressStartedInside) {
          return;
        }

        const pressStartedInsideDefaultPrevented = pressStartPrevented;
        resetPressStartState();

        if (getOutsidePressEvent() !== "intentional") {
          return;
        }

        if (event.type === "pointercancel") {
          if (pressStartedInsideDefaultPrevented) {
            suppressImmediateOutsideClickAfterPreventedStart();
          }
          return;
        }

        if (isEventWithinFloatingTree(event)) {
          return;
        }

        // If pointerdown was prevented, no click may be generated for that
        // interaction. Firefox may still emit an immediate click after
        // pointerup, so suppress for one tick to absorb that synthetic click.
        if (pressStartedInsideDefaultPrevented) {
          suppressImmediateOutsideClickAfterPreventedStart();
          return;
        }

        // Avoid suppressing when outsidePress explicitly ignores this target.
        if (typeof outsidePress === "function" && !outsidePress(event as MouseEvent)) {
          return;
        }

        clearTimeout(preventedPressSuppressionTimer);
        suppressNextOutsideClick = true;
        clearInsideReactTree();
      }

      function handleTouchMove(event: TouchEvent) {
        if (getOutsidePressEvent() !== "sloppy" || !touchState || isEventWithinOwnElements(event)) {
          return;
        }

        const touch = event.touches[0];
        if (!touch) {
          return;
        }

        const deltaX = Math.abs(touch.clientX - touchState.startX);
        const deltaY = Math.abs(touch.clientY - touchState.startY);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Scrolling away after `touchstart` dismisses in `sloppy` mode: this
        // is the ancestor-scroll handling (touch scroll on an ancestor
        // dismisses the floating element once the gesture moves far enough).
        if (distance > 5) {
          touchState.dismissOnTouchEnd = true;
        }

        if (distance > 10) {
          closeOnPressOutside(event);
          clearTimeout(cancelDismissOnEndTimer);
          touchState = null;
        }
      }

      function handleTouchMoveCapture(event: TouchEvent) {
        addTargetEventListenerOnce(event, handleTouchMove);
      }

      function handleTouchEnd(event: TouchEvent) {
        if (getOutsidePressEvent() !== "sloppy" || !touchState || isEventWithinOwnElements(event)) {
          return;
        }

        if (touchState.dismissOnTouchEnd) {
          closeOnPressOutside(event);
        }

        clearTimeout(cancelDismissOnEndTimer);
        touchState = null;
      }

      function handleTouchEndCapture(event: TouchEvent) {
        addTargetEventListenerOnce(event, handleTouchEnd);
      }

      const cleanups = [
        ...(escapeKey
          ? [
              addListener(doc, "keydown", closeOnEscapeKeyDown),
              addListener(doc, "compositionstart", handleCompositionStart),
              addListener(doc, "compositionend", handleCompositionEnd),
            ]
          : []),
        ...(outsidePressEnabled
          ? [
              addListener(doc, "click", closeOnPressOutsideCapture, { capture: true }),
              addListener(doc, "pointerdown", closeOnPressOutsideCapture, { capture: true }),
              addListener(doc, "pointerup", handlePressEndCapture, { capture: true }),
              addListener(doc, "pointercancel", handlePressEndCapture, { capture: true }),
              addListener(doc, "mousedown", closeOnPressOutsideCapture, { capture: true }),
              addListener(doc, "mouseup", handlePressEndCapture, { capture: true }),
              addListener(doc, "touchstart", handleTouchStartCapture, { capture: true, passive: true }),
              addListener(doc, "touchmove", handleTouchMoveCapture, { capture: true, passive: true }),
              addListener(doc, "touchend", handleTouchEndCapture, { capture: true, passive: true }),
            ]
          : []),
      ];

      return () => {
        cleanups.forEach((cleanup) => cleanup());
        clearTimeout(compositionTimer);
        clearTimeout(preventedPressSuppressionTimer);
        resetPressStartState();
        suppressNextOutsideClick = false;
        clearInsideReactTree();
      };
    },
  );

  // Capture-phase floating listeners. Attached imperatively (rather than as
  // `onClickCapture`-style props) so ordering against the document capture
  // handler's one-shot target listener matches upstream regardless of JSX
  // capture-suffix support.
  createEffect(
    () => store.select("floatingElement"),
    (floating) => {
      if (!floating) {
        return undefined;
      }

      const cleanups = [
        addListener(floating, "click", markInsideReactTree, { capture: true }),
        addListener(
          floating,
          "mousedown",
          (event: Event) => {
            markInsideReactTree();
            markPressStartedInsideReactTree(event as MouseEvent);
          },
          { capture: true },
        ),
        addListener(
          floating,
          "pointerdown",
          (event: Event) => {
            markInsideReactTree();
            markPressStartedInsideReactTree(event as PointerEvent);
          },
          { capture: true },
        ),
        addListener(floating, "mouseup", markInsideReactTree, { capture: true }),
        addListener(floating, "touchend", markInsideReactTree, { capture: true }),
        addListener(floating, "touchmove", markInsideReactTree, { capture: true }),
      ];

      return () => {
        cleanups.forEach((cleanup) => cleanup());
      };
    },
  );

  const referenceProps: DismissReferenceProps = {
    onKeyDown: closeOnEscapeKeyDown,
    onPointerDown: closeOnReferencePress,
    onClick: closeOnReferencePress,
  };

  // Bubble-phase floating handlers; capture-phase marking is attached above.
  const floatingProps: DismissFloatingProps = {
    onKeyDown: closeOnEscapeKeyDown,
    // `onMouseDown` may be blocked if `event.preventDefault()` is called in
    // `onPointerDown`. See https://github.com/mui/base-ui/pull/3379
    onPointerDown: markInsidePressStartPrevented,
    onMouseDown: markInsidePressStartPrevented,
  };

  const reference = () => (enabled ? referenceProps : ({} as DismissReferenceProps));
  const floating = () => (enabled ? floatingProps : ({} as DismissFloatingProps));

  return { reference, floating };
}
