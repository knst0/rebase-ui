import { dynamicElement, effect, getOwner, omitProps, onCleanup, runWithOwner, store, untrack, type JSX } from "reze-js";

import { activeElement, contains, getTarget } from "../../internals/floating/utils/element";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument } from "../../internals/utils/owner";
import { useToastProviderContext } from "../provider/ToastProviderContext";
import type { ToastObject } from "../useToastManager";
import { ToastRootContext } from "./ToastRootContext";
import * as ToastRootCssVars from "./ToastRootCssVars";

const SWIPE_THRESHOLD = 40;
const REVERSE_CANCEL_THRESHOLD = 10;
const OPPOSITE_DIRECTION_DAMPING_FACTOR = 0.5;
const MIN_DRAG_THRESHOLD = 1;
const TOAST_SWIPE_IGNORE_SELECTOR = "[data-base-ui-swipe-ignore],[data-swipe-ignore]";

export type ToastSwipeDirection = "up" | "down" | "left" | "right";

function getDisplacement(direction: ToastSwipeDirection, deltaX: number, deltaY: number) {
  switch (direction) {
    case "up":
      return -deltaY;
    case "down":
      return deltaY;
    case "left":
      return -deltaX;
    case "right":
      return deltaX;
    default:
      return 0;
  }
}

/**
 * Extracts the 2D translation and scale from the element's computed `transform` matrix.
 */
function getElementTransform(element: HTMLElement) {
  const transform = ownerDocument(element).defaultView?.getComputedStyle(element).transform;
  let translateX = 0;
  let translateY = 0;
  let scale = 1;

  if (transform && transform !== "none") {
    const matrix = transform.match(/matrix(?:3d)?\(([^)]+)\)/);
    if (matrix) {
      const values = matrix[1].split(", ").map(parseFloat);
      if (values.length === 6) {
        translateX = values[4];
        translateY = values[5];
        scale = Math.sqrt(values[0] * values[0] + values[1] * values[1]);
      } else if (values.length === 16) {
        translateX = values[12];
        translateY = values[13];
        scale = values[0];
      }
    }
  }

  return { x: translateX, y: translateY, scale };
}

/**
 * Groups all parts of an individual toast.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Toast](https://rebase-ui.knst.dev/components/toast)
 */
export function ToastRoot<T extends JSX.ElementType = "div">(props: ToastRoot.Props<T>) {
  const rest = omitProps(props, "as", "toast", "swipeDirection", "onKeyDown", "onPointerDown", "class", "style", "children", "ref");

  // Structural: the swipe configuration is fixed for the lifetime of the instance.
  const swipeDirections = ((): ToastSwipeDirection[] => {
    const isAnchored = (props.toast as ToastObject<any>).positionerProps?.anchor !== undefined;
    if (isAnchored) {
      return [];
    }
    const swipeDirection = props.swipeDirection ?? (["down", "right"] as ToastSwipeDirection[]);
    return (Array.isArray(swipeDirection) ? swipeDirection : [swipeDirection]) as ToastSwipeDirection[];
  })();
  const swipeEnabled = swipeDirections.length > 0;

  const toastStore = useToastProviderContext();

  const rootState = store({
    element: null as HTMLDivElement | null,
    currentSwipeDirection: undefined as ToastSwipeDirection | undefined,
    isSwiping: false,
    isRealSwipe: false,
    dragOffset: { x: 0, y: 0 },
    initialTransform: { x: 0, y: 0, scale: 1 },
    titleId: undefined as string | undefined,
    descriptionId: undefined as string | undefined,
    lockedDirection: null as "horizontal" | "vertical" | null,
  });

  function setCurrentSwipeDirection(next: ToastSwipeDirection | undefined) {
    untrack(() => {
      if (rootState.currentSwipeDirection !== next) {
        rootState.currentSwipeDirection = next;
      }
    });
  }

  function setIsSwiping(next: boolean) {
    untrack(() => {
      if (rootState.isSwiping !== next) {
        rootState.isSwiping = next;
      }
    });
  }

  function setIsRealSwipe(next: boolean) {
    untrack(() => {
      if (rootState.isRealSwipe !== next) {
        rootState.isRealSwipe = next;
      }
    });
  }

  function setResolvedDragOffset(nextDragOffset: { x: number; y: number }) {
    dragOffsetRef.x = nextDragOffset.x;
    dragOffsetRef.y = nextDragOffset.y;
    untrack(() => {
      if (rootState.dragOffset.x !== nextDragOffset.x || rootState.dragOffset.y !== nextDragOffset.y) {
        rootState.dragOffset = { x: nextDragOffset.x, y: nextDragOffset.y };
      }
    });
  }

  function setInitialTransform(next: { x: number; y: number; scale: number }) {
    untrack(() => {
      const prev = rootState.initialTransform;
      if (prev.x !== next.x || prev.y !== next.y || prev.scale !== next.scale) {
        rootState.initialTransform = { x: next.x, y: next.y, scale: next.scale };
      }
    });
  }

  function setTitleId(next: string | undefined | ((prev: string | undefined) => string | undefined)) {
    untrack(() => {
      const value = typeof next === "function" ? next(rootState.titleId) : next;
      if (rootState.titleId !== value) {
        rootState.titleId = value;
      }
    });
  }

  function setDescriptionId(next: string | undefined | ((prev: string | undefined) => string | undefined)) {
    untrack(() => {
      const value = typeof next === "function" ? next(rootState.descriptionId) : next;
      if (rootState.descriptionId !== value) {
        rootState.descriptionId = value;
      }
    });
  }

  function setLockedDirection(next: "horizontal" | "vertical" | null) {
    untrack(() => {
      if (rootState.lockedDirection !== next) {
        rootState.lockedDirection = next;
      }
    });
  }

  function setRootElement(element: HTMLDivElement | null) {
    // One-shot write: the element only steers the completion runner below.
    untrack(() => {
      if (rootState.element !== element) {
        rootState.element = element;
      }
    });
  }

  let touchMoveElement: HTMLDivElement | null = null;
  let lastToastId: string | undefined;
  const dragStartPos = { x: 0, y: 0 };
  const initialTransformRef = { x: 0, y: 0, scale: 1 };
  let intendedSwipeDirection: ToastSwipeDirection | undefined;
  let maxSwipeDisplacement = 0;
  let cancelledSwipe = false;
  const swipeCancelBaseline = { x: 0, y: 0 };
  let isFirstPointerMove = false;
  const dragOffsetRef = { x: 0, y: 0 };
  let activePointerId: number | null = null;
  let dragAbortController: AbortController | null = null;

  const refApi = { current: null as HTMLElement | null };

  const domIndex = () => toastStore.select("toastIndex", props.toast.id) as number;
  const visibleIndex = () => toastStore.select("toastVisibleIndex", props.toast.id) as number;
  const offsetY = () => toastStore.select("toastOffsetY", props.toast.id) as number;
  const focused = () => toastStore.select("focused") as boolean;
  const expanded = () => toastStore.select("expanded") as boolean;

  // The toast object is a reactive prop: reading it inside untracked effect
  // continuations (or callbacks invoked synchronously from them, like
  // `onComplete`) never subscribes. Mirror the id into a plain variable from
  // the tracking scope instead.
  let latestToastId: string | undefined;

  // The element is store-backed so this effect re-runs once it mounts: effects
  // run synchronously during creation (while the element is still null), and
  // the runner bails on a null element without rescheduling by itself.
  runOnOpenChangeComplete({
    open: () => props.toast.transitionStatus !== "ending",
    ref: () => rootState.element,
    onComplete: () => {
      const id = latestToastId;
      if (id !== undefined && toastStore.peek("toast", id)?.transitionStatus === "ending") {
        toastStore.removeToast(id);
      }
    },
  });

  // Recalculates the natural height of the toast and updates it in the toast manager.
  // The store ignores this write while the toast is transitioning out.
  // Recalculates the natural height of the toast and updates it in the toast manager.
  // The store ignores this write while the toast is transitioning out.
  function recalculateHeight() {
    const element = untrack(() => rootState.element);
    const id = latestToastId;
    if (!element || id === undefined) {
      return;
    }

    const previousHeight = element.style.height;
    element.style.height = "auto";

    const height = element.offsetHeight;

    element.style.height = previousHeight;

    // Skip the write when nothing changed: every store write replaces the toast
    // object, and a replaced object recreates this root inside `<For>` lists.
    // An unconditional write would recreate the root on every measurement, and
    // the fresh instance (with its own `refApi`) would write again — forever.
    // The registered ref object is reused across recreations; only its `.current`
    // is repointed at the live element.
    const current = toastStore.peek("toast", id) as ToastObject<any> | undefined;
    if (current !== undefined && current.transitionStatus === undefined && current.height === height && current.ref !== undefined) {
      if (current.ref.current !== element) {
        current.ref.current = element;
      }
      return;
    }

    toastStore.updateToastInternal(id, {
      ref: current?.ref ?? refApi,
      height,
      transitionStatus: undefined,
    });
  }

  // Initialize the toast on mount, and reinitialize when it begins a new lifecycle:
  // re-adding an ending toast retains the same root instance (`key={toast.id}`), and
  // index-keyed lists can hand an existing instance a different toast.
  effect(() => {
    const id = props.toast.id;
    const transitionStatus = props.toast.transitionStatus;
    // One-shot writes: the values only steer this initialization.
    untrack(() => {
      latestToastId = id;

      // `recalculateHeight` clears the `starting` status itself, so bail out on the
      // resulting re-run and on the later `ending` one, which the store discards anyway.
      if (transitionStatus !== "starting" && lastToastId === id) {
        return;
      }

      if (lastToastId !== undefined) {
        // A retained root keeps component-local swipe state from its previous lifecycle;
        // clear it so the toast doesn't stay offset or exit in the swiped direction.
        setCurrentSwipeDirection(undefined);
        setInitialTransform({ x: 0, y: 0, scale: 1 });
        setResolvedDragOffset({ x: 0, y: 0 });
      }

      lastToastId = id;
      recalculateHeight();
    });
  });

  effect(() => {
    onCleanup(() => {
      touchMoveElement?.removeEventListener("touchmove", preventDefaultTouchStart);
      touchMoveElement = null;
      dragAbortController?.abort();
    });
  });

  function preventDefaultTouchStart(event: TouchEvent) {
    const element = touchMoveElement;
    if (activePointerId === null || !element || !contains(element, getTarget(event) as HTMLElement | null)) {
      return;
    }

    // The pointermove preventDefault is not enough on iOS; this
    // non-passive touchmove listener blocks native scrolling while dragging.
    event.preventDefault();
  }

  function handleRootRef(element: HTMLDivElement | null) {
    setRootElement(element);
    refApi.current = element;
    if (element && swipeEnabled && touchMoveElement !== element) {
      touchMoveElement?.removeEventListener("touchmove", preventDefaultTouchStart);
      touchMoveElement = element;
      element.addEventListener("touchmove", preventDefaultTouchStart, { passive: false });
    }
  }

  function applyDirectionalDamping(deltaX: number, deltaY: number) {
    const damp = (delta: number) =>
      delta > 0 ? delta ** OPPOSITE_DIRECTION_DAMPING_FACTOR : -(Math.abs(delta) ** OPPOSITE_DIRECTION_DAMPING_FACTOR);

    const dampX = (deltaX > 0 && !swipeDirections.includes("right")) || (deltaX < 0 && !swipeDirections.includes("left"));
    const dampY = (deltaY > 0 && !swipeDirections.includes("down")) || (deltaY < 0 && !swipeDirections.includes("up"));

    return {
      x: dampX ? damp(deltaX) : deltaX,
      y: dampY ? damp(deltaY) : deltaY,
    };
  }

  function handleSwipeEnd(event: PointerEvent) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = null;
    dragAbortController?.abort();
    dragAbortController = null;
    setIsSwiping(false);
    setIsRealSwipe(false);
    setLockedDirection(null);

    const resolvedInitialTransform = { ...initialTransformRef };

    if (event.type === "pointercancel" || cancelledSwipe) {
      setResolvedDragOffset({ x: resolvedInitialTransform.x, y: resolvedInitialTransform.y });
      setCurrentSwipeDirection(undefined);
      return;
    }

    const resolvedDragOffset = { ...dragOffsetRef };
    const deltaX = resolvedDragOffset.x - resolvedInitialTransform.x;
    const deltaY = resolvedDragOffset.y - resolvedInitialTransform.y;
    let dismissDirection: ToastSwipeDirection | undefined;

    for (const direction of swipeDirections) {
      if (getDisplacement(direction, deltaX, deltaY) > SWIPE_THRESHOLD) {
        dismissDirection = direction;
        break;
      }
    }

    if (dismissDirection) {
      setCurrentSwipeDirection(dismissDirection);
      toastStore.closeToast(props.toast.id);
    } else {
      setResolvedDragOffset({ x: resolvedInitialTransform.x, y: resolvedInitialTransform.y });
      setCurrentSwipeDirection(undefined);
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }

    if (event.pointerType === "touch") {
      toastStore.pauseTimers();
    }

    const target = getTarget(event) as HTMLElement | null;

    const isInteractiveElement = target?.closest?.(`button,a,input,textarea,[role="button"],${TOAST_SWIPE_IGNORE_SELECTOR}`);

    if (isInteractiveElement) {
      return;
    }

    cancelledSwipe = false;
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;
    activePointerId = event.pointerId;
    dragStartPos.x = event.clientX;
    dragStartPos.y = event.clientY;
    swipeCancelBaseline.x = dragStartPos.x;
    swipeCancelBaseline.y = dragStartPos.y;

    const element = event.currentTarget as HTMLDivElement;

    const transform = getElementTransform(element);
    initialTransformRef.x = transform.x;
    initialTransformRef.y = transform.y;
    initialTransformRef.scale = transform.scale;
    setInitialTransform(transform);
    setResolvedDragOffset({
      x: transform.x,
      y: transform.y,
    });

    toastStore.set("hovering", true);
    setIsSwiping(true);
    setIsRealSwipe(false);
    setLockedDirection(null);
    isFirstPointerMove = true;

    dragAbortController?.abort();
    const controller = new AbortController();
    dragAbortController = controller;

    const doc = ownerDocument(element);
    doc.addEventListener("pointerup", handleSwipeEnd, { signal: controller.signal });
    doc.addEventListener("pointercancel", handleSwipeEnd, { signal: controller.signal });

    try {
      element.setPointerCapture?.(event.pointerId);
    } catch {
      // Ignore failures when the pointer is already released.
    }
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    // Prevent text selection on Safari
    event.preventDefault();

    if (isFirstPointerMove) {
      // Adjust the starting position to the current position on the first move
      // to account for the delay between pointerdown and the first pointermove on iOS.
      dragStartPos.x = event.clientX;
      dragStartPos.y = event.clientY;
      isFirstPointerMove = false;
    }

    const { clientY, clientX } = event;
    const movementX = event.movementX ?? 0;
    const movementY = event.movementY ?? 0;

    if ((movementY < 0 && clientY > swipeCancelBaseline.y) || (movementY > 0 && clientY < swipeCancelBaseline.y)) {
      swipeCancelBaseline.y = clientY;
    }

    if ((movementX < 0 && clientX > swipeCancelBaseline.x) || (movementX > 0 && clientX < swipeCancelBaseline.x)) {
      swipeCancelBaseline.x = clientX;
    }

    const deltaX = clientX - dragStartPos.x;
    const deltaY = clientY - dragStartPos.y;
    const cancelDeltaY = clientY - swipeCancelBaseline.y;
    const cancelDeltaX = clientX - swipeCancelBaseline.x;

    let resolvedLockedDirection = rootState.lockedDirection;

    if (!rootState.isRealSwipe) {
      const movementDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (movementDistance >= MIN_DRAG_THRESHOLD) {
        setIsRealSwipe(true);
        // `lockedDirection` is always reset alongside `isRealSwipe`, so it is
        // still `null` here. Locking is only meaningful when both axes are
        // swipeable; otherwise the single axis already constrains the gesture.
        const hasHorizontal = swipeDirections.includes("left") || swipeDirections.includes("right");
        const hasVertical = swipeDirections.includes("up") || swipeDirections.includes("down");
        if (hasHorizontal && hasVertical) {
          const absX = Math.abs(deltaX);
          const absY = Math.abs(deltaY);
          resolvedLockedDirection = absX > absY ? "horizontal" : "vertical";
          setLockedDirection(resolvedLockedDirection);
        }
      }
    }

    let candidate: ToastSwipeDirection | undefined;
    if (!intendedSwipeDirection) {
      if (resolvedLockedDirection === "vertical") {
        if (deltaY > 0) {
          candidate = "down";
        } else if (deltaY < 0) {
          candidate = "up";
        }
      } else if (resolvedLockedDirection === "horizontal") {
        if (deltaX > 0) {
          candidate = "right";
        } else if (deltaX < 0) {
          candidate = "left";
        }
      } else if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        candidate = deltaX > 0 ? "right" : "left";
      } else {
        candidate = deltaY > 0 ? "down" : "up";
      }

      if (candidate && swipeDirections.includes(candidate)) {
        intendedSwipeDirection = candidate;
        maxSwipeDisplacement = getDisplacement(candidate, deltaX, deltaY);
        setCurrentSwipeDirection(candidate);
      }
    } else {
      const direction = intendedSwipeDirection;
      const currentDisplacement = getDisplacement(direction, cancelDeltaX, cancelDeltaY);

      if (currentDisplacement > SWIPE_THRESHOLD) {
        cancelledSwipe = false;
        setCurrentSwipeDirection(direction);
      } else if (
        !(swipeDirections.includes("left") && swipeDirections.includes("right")) &&
        !(swipeDirections.includes("up") && swipeDirections.includes("down")) &&
        maxSwipeDisplacement - currentDisplacement >= REVERSE_CANCEL_THRESHOLD
      ) {
        // Mark that a change-of-mind has occurred
        cancelledSwipe = true;
      }
    }

    const dampedDelta = applyDirectionalDamping(deltaX, deltaY);
    let newOffsetX = initialTransformRef.x;
    let newOffsetY = initialTransformRef.y;

    const hasHorizontalDir = swipeDirections.includes("left") || swipeDirections.includes("right");
    const hasVerticalDir = swipeDirections.includes("up") || swipeDirections.includes("down");

    if (resolvedLockedDirection !== "vertical" && hasHorizontalDir) {
      newOffsetX += dampedDelta.x;
    }

    if (resolvedLockedDirection !== "horizontal" && hasVerticalDir) {
      newOffsetY += dampedDelta.y;
    }

    setResolvedDragOffset({ x: newOffsetX, y: newOffsetY });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      const element = rootState.element;
      if (!element || !contains(element, activeElement(ownerDocument(element)))) {
        return;
      }

      toastStore.closeToast(props.toast.id);
    }
  }

  function internalStyle(): Record<string, string | number | undefined> {
    const offset = rootState.dragOffset;
    const transform = rootState.initialTransform;
    const swiping = rootState.isSwiping;
    const deltaX = offset.x - transform.x;
    const deltaY = offset.y - transform.y;
    const index = props.toast.transitionStatus === "ending" ? domIndex() : visibleIndex();

    return {
      transition: swiping ? "none" : undefined,
      // While swiping, freeze the element at its current visual transform so it doesn't snap to the
      // end position.
      transform: swiping ? `translateX(${offset.x}px) translateY(${offset.y}px) scale(${transform.scale})` : undefined,
      [ToastRootCssVars.swipeMovementX]: `${deltaX}px`,
      [ToastRootCssVars.swipeMovementY]: `${deltaY}px`,
      [ToastRootCssVars.index]: index,
      [ToastRootCssVars.offsetY]: `${offsetY()}px`,
      [ToastRootCssVars.height]: props.toast.height ? `${props.toast.height}px` : undefined,
    };
  }

  function snapshot(): ToastRootState {
    return {
      transitionStatus: props.toast.transitionStatus,
      expanded: expanded(),
      limited: props.toast.limited || false,
      type: props.toast.type,
      swiping: rootState.isSwiping,
      swipeDirection: rootState.currentSwipeDirection,
    };
  }

  const contextValue: ToastRootContext = {
    toast: () => props.toast as ToastObject<any>,
    setTitleId,
    setDescriptionId,
    visibleIndex,
    expanded,
    recalculateHeight,
  };

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  const ref = mergeRefs(handleRootRef, props.ref as ((element: HTMLDivElement | null) => void) | undefined);

  // Element props overwrite the internal handlers in the Solid layer; a custom
  // handler therefore replaces the built-in swipe and Escape handling.
  const pointerDownHandler = props.onPointerDown ?? (swipeEnabled ? handlePointerDown : undefined);
  const pointerMoveHandler = props.onPointerMove ?? (swipeEnabled ? handlePointerMove : undefined);
  const pointerUpHandler = props.onPointerUp ?? (swipeEnabled ? handleSwipeEnd : undefined);
  const pointerCancelHandler = props.onPointerCancel ?? (swipeEnabled ? handleSwipeEnd : undefined);
  const keyDownHandler = props.onKeyDown ?? handleKeyDown;

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a
  // sibling mounts or unmounts, which would drop the toast's listeners and swipe
  // state. The default path renders a static `<div>` so toast updates patch it in
  // place; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        tabindex={0}
        role={props.toast.priority === "high" ? "alertdialog" : "dialog"}
        aria-modal="false"
        aria-labelledby={rootState.titleId ?? undefined}
        aria-describedby={rootState.descriptionId ?? undefined}
        aria-hidden={props.toast.priority === "high" && !focused() ? ("true" as const) : undefined}
        inert={props.toast.limited ? true : undefined}
        onPointerDown={pointerDownHandler}
        onPointerMove={pointerMoveHandler}
        onPointerUp={pointerUpHandler}
        onPointerCancel={pointerCancelHandler}
        onKeyDown={keyDownHandler}
        data-expanded={expanded() ? "" : undefined}
        data-limited={props.toast.limited ? "" : undefined}
        data-type={props.toast.type ?? undefined}
        data-swiping={rootState.isSwiping ? "" : undefined}
        data-swipe-direction={rootState.currentSwipeDirection ?? undefined}
        data-starting-style={props.toast.transitionStatus === "starting" ? "" : undefined}
        data-ending-style={props.toast.transitionStatus === "ending" ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={mergeStyleValue(internalStyle() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
        ref={ref}
      >
        <ToastRootContext value={contextValue}>
          <ToastRootContent snapshot={snapshot}>{props.children}</ToastRootContent>
        </ToastRootContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      tabindex={0}
      role={props.toast.priority === "high" ? "alertdialog" : "dialog"}
      aria-modal="false"
      aria-labelledby={rootState.titleId ?? undefined}
      aria-describedby={rootState.descriptionId ?? undefined}
      aria-hidden={props.toast.priority === "high" && !focused() ? ("true" as const) : undefined}
      inert={props.toast.limited ? true : undefined}
      onPointerDown={pointerDownHandler}
      onPointerMove={pointerMoveHandler}
      onPointerUp={pointerUpHandler}
      onPointerCancel={pointerCancelHandler}
      onKeyDown={keyDownHandler}
      data-expanded={expanded() ? "" : undefined}
      data-limited={props.toast.limited ? "" : undefined}
      data-type={props.toast.type ?? undefined}
      data-swiping={rootState.isSwiping ? "" : undefined}
      data-swipe-direction={rootState.currentSwipeDirection ?? undefined}
      data-starting-style={props.toast.transitionStatus === "starting" ? "" : undefined}
      data-ending-style={props.toast.transitionStatus === "ending" ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(internalStyle() as Record<string, string | undefined>, resolveStyleValue(props.style, snapshot()))}
      ref={ref}
    >
      <ToastRootContext value={contextValue}>
        <ToastRootContent snapshot={snapshot}>{props.children}</ToastRootContent>
      </ToastRootContext>
    </Tag>
  );
}

/**
 * Resolves the root children inside the toast context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the toast state changes.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function ToastRootContent(props: { children: ToastRoot.Props["children"]; snapshot: () => ToastRootState }) {
  const children = props.children;

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: ToastRootState) => JSX.Element;
    const snapshot = props.snapshot;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the toast context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const state = snapshot();

      return runWithOwner(owner, () => render(state));
    };
  }

  return children as JSX.Element;
}

export type ToastRootToastObject<Data extends object = any> = ToastObject<Data>;

export interface ToastRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the toasts in the viewport are expanded.
   */
  expanded: boolean;
  /**
   * Whether the toast was limited because the toast limit was exceeded.
   */
  limited: boolean;
  /**
   * The type of the toast.
   */
  type: string | undefined;
  /**
   * Whether the toast is being swiped.
   */
  swiping: boolean;
  /**
   * The direction the toast is being swiped.
   */
  swipeDirection: ToastSwipeDirection | undefined;
}

export interface ToastRootOwnProps {
  /**
   * The toast to render.
   */
  toast: ToastRootToastObject<any>;
  /**
   * Direction(s) in which the toast can be swiped to dismiss.
   * @default ['down', 'right']
   */
  swipeDirection?: ToastSwipeDirection | ToastSwipeDirection[] | undefined;
  /**
   * Handler for the toast's `keydown` event. Replaces the built-in Escape-to-close handling.
   */
  onKeyDown?: JSX.IntrinsicElements["div"]["onKeyDown"] | undefined;
  /**
   * Handler for the toast's `pointerdown` event. Replaces the built-in swipe-to-dismiss handling.
   */
  onPointerDown?: JSX.IntrinsicElements["div"]["onPointerDown"] | undefined;
}

export type ToastRootProps<T extends JSX.ElementType = "div"> = ToastRootOwnProps & RebaseUIComponentProps<T, ToastRootState>;

export namespace ToastRoot {
  export type ToastObject<Data extends object = any> = ToastRootToastObject<Data>;
  export type State = ToastRootState;
  export type Props<T extends JSX.ElementType = "div"> = ToastRootProps<T>;
  export type OwnProps = ToastRootOwnProps;
}
