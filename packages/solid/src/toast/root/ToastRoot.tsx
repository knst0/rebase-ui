import type { JSX, ValidComponent } from "@solidjs/web";
import { createEffect, createSignal, onSettled, untrack } from "solid-js";

import { activeElement, contains, getTarget } from "../../internals/floating/utils/element";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { runOnOpenChangeComplete } from "../../internals/runOnOpenChangeComplete";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument } from "../../internals/utils/owner";
import { useToastProviderContext } from "../provider/ToastProviderContext";
import type { ToastObject } from "../useToastManager";
import { toastRootStateAttributesMapping } from "../utils/stateAttributesMapping";
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
export function ToastRoot<T extends ValidComponent = "div">(props: ToastRoot.Props<T>) {
  const [local, elementProps] = split(props as ToastRoot.Props, { default: defaultProps }, ["as", "toast", "swipeDirection"]);

  const as = untrack(() => local.as);

  // Structural: the swipe configuration is fixed for the lifetime of the instance.
  const swipeDirections = untrack((): ToastSwipeDirection[] => {
    const isAnchored = (local.toast as ToastObject<any>).positionerProps?.anchor !== undefined;
    if (isAnchored) {
      return [];
    }
    const swipeDirection = local.swipeDirection ?? (["down", "right"] as ToastSwipeDirection[]);
    return (Array.isArray(swipeDirection) ? swipeDirection : [swipeDirection]) as ToastSwipeDirection[];
  });
  const swipeEnabled = swipeDirections.length > 0;

  const store = useToastProviderContext();

  // These signals are written from effect apply callbacks (toast lifecycle
  // re-initialization, label id registration in Title/Description) as well as
  // event handlers, so they opt into owned writes like the store version signals.
  const [currentSwipeDirection, setCurrentSwipeDirection] = createSignal<ToastSwipeDirection | undefined>(undefined, {
    ownedWrite: true,
  });
  const [isSwiping, setIsSwiping] = createSignal(false, { ownedWrite: true });
  const [isRealSwipe, setIsRealSwipe] = createSignal(false, { ownedWrite: true });
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 }, { ownedWrite: true });
  const [initialTransform, setInitialTransform] = createSignal({ x: 0, y: 0, scale: 1 }, { ownedWrite: true });
  const [titleId, setTitleId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  const [descriptionId, setDescriptionId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  const [lockedDirection, setLockedDirection] = createSignal<"horizontal" | "vertical" | null>(null, {
    ownedWrite: true,
  });

  let rootElement: HTMLDivElement | null = null;
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

  const domIndex = () => store.select("toastIndex", local.toast.id) as number;
  const visibleIndex = () => store.select("toastVisibleIndex", local.toast.id) as number;
  const offsetY = () => store.select("toastOffsetY", local.toast.id) as number;
  const focused = () => store.select("focused") as boolean;
  const expanded = () => store.select("expanded") as boolean;

  // The toast object is a reactive prop: reading it inside effect apply callbacks
  // (or callbacks invoked synchronously from them, like `onComplete`) warns.
  // Mirror the id into a plain variable from the tracking scope instead.
  let latestToastId: string | undefined;

  runOnOpenChangeComplete({
    open: () => local.toast.transitionStatus !== "ending",
    ref: () => rootElement,
    onComplete: () => {
      const id = latestToastId;
      if (id !== undefined && store.peek("toast", id)?.transitionStatus === "ending") {
        store.removeToast(id);
      }
    },
  });

  // Recalculates the natural height of the toast and updates it in the toast manager.
  // The store ignores this write while the toast is transitioning out.
  function recalculateHeight() {
    const element = rootElement;
    const id = latestToastId;
    if (!element || id === undefined) {
      return;
    }

    const previousHeight = element.style.height;
    element.style.height = "auto";

    const height = element.offsetHeight;

    element.style.height = previousHeight;

    store.updateToastInternal(id, {
      ref: refApi,
      height,
      transitionStatus: undefined,
    });
  }

  // Initialize the toast on mount, and reinitialize when it begins a new lifecycle:
  // re-adding an ending toast retains the same root instance (`key={toast.id}`), and
  // index-keyed lists can hand an existing instance a different toast.
  createEffect(
    () => ({ id: local.toast.id, transitionStatus: local.toast.transitionStatus }),
    ({ id, transitionStatus }) => {
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
    },
  );

  function setResolvedDragOffset(nextDragOffset: { x: number; y: number }) {
    dragOffsetRef.x = nextDragOffset.x;
    dragOffsetRef.y = nextDragOffset.y;
    setDragOffset(nextDragOffset);
  }

  onSettled(() => {
    return () => {
      dragAbortController?.abort();
    };
  });

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
      store.closeToast(local.toast.id);
    } else {
      setResolvedDragOffset({ x: resolvedInitialTransform.x, y: resolvedInitialTransform.y });
      setCurrentSwipeDirection(undefined);
    }
  }

  function handlePointerDown(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (event.button !== 0) {
      return;
    }

    if (event.pointerType === "touch") {
      store.pauseTimers();
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

    const element = event.currentTarget;

    const transform = getElementTransform(element);
    initialTransformRef.x = transform.x;
    initialTransformRef.y = transform.y;
    initialTransformRef.scale = transform.scale;
    setInitialTransform(transform);
    setResolvedDragOffset({
      x: transform.x,
      y: transform.y,
    });

    store.set("hovering", true);
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

    let resolvedLockedDirection = lockedDirection();

    if (!isRealSwipe()) {
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
      if (!rootElement || !contains(rootElement, activeElement(ownerDocument(rootElement)))) {
        return;
      }

      store.closeToast(local.toast.id);
    }
  }

  onSettled(() => {
    const element = rootElement;
    if (!swipeEnabled || !element) {
      return undefined;
    }

    function preventDefaultTouchStart(event: TouchEvent) {
      if (activePointerId === null || !contains(element, getTarget(event) as HTMLElement | null)) {
        return;
      }

      // The pointermove preventDefault is not enough on iOS; this
      // non-passive touchmove listener blocks native scrolling while dragging.
      event.preventDefault();
    }

    element.addEventListener("touchmove", preventDefaultTouchStart, { passive: false });
    return () => {
      element.removeEventListener("touchmove", preventDefaultTouchStart);
    };
  });

  function getDragStyles(): JSX.CSSProperties {
    const offset = dragOffset();
    const transform = initialTransform();
    const swiping = isSwiping();
    const deltaX = offset.x - transform.x;
    const deltaY = offset.y - transform.y;

    return {
      transition: swiping ? "none" : undefined,
      // While swiping, freeze the element at its current visual transform so it doesn't snap to the
      // end position.
      transform: swiping ? `translateX(${offset.x}px) translateY(${offset.y}px) scale(${transform.scale})` : undefined,
      [ToastRootCssVars.swipeMovementX]: `${deltaX}px`,
      [ToastRootCssVars.swipeMovementY]: `${deltaY}px`,
    };
  }

  const state: ToastRootState = {
    get transitionStatus() {
      return local.toast.transitionStatus;
    },
    get expanded() {
      return expanded();
    },
    get limited() {
      return local.toast.limited || false;
    },
    get type() {
      return local.toast.type;
    },
    get swiping() {
      return isSwiping();
    },
    get swipeDirection() {
      return currentSwipeDirection();
    },
  };

  const rootProps = {
    tabindex: 0,
    "aria-modal": "false" as const,
    get "aria-labelledby"() {
      return titleId();
    },
    get "aria-describedby"() {
      return descriptionId();
    },
    get "aria-hidden"() {
      return local.toast.priority === "high" && !focused() ? ("true" as const) : undefined;
    },
    get inert() {
      return local.toast.limited ? true : undefined;
    },
    onPointerDown: swipeEnabled ? handlePointerDown : undefined,
    onPointerMove: swipeEnabled ? handlePointerMove : undefined,
    onPointerUp: swipeEnabled ? handleSwipeEnd : undefined,
    onPointerCancel: swipeEnabled ? handleSwipeEnd : undefined,
    onKeyDown: handleKeyDown,
    get role() {
      return local.toast.priority === "high" ? "alertdialog" : "dialog";
    },
    get style(): JSX.CSSProperties {
      const index = local.toast.transitionStatus === "ending" ? domIndex() : visibleIndex();
      return {
        ...getDragStyles(),
        [ToastRootCssVars.index]: index,
        [ToastRootCssVars.offsetY]: `${offsetY()}px`,
        [ToastRootCssVars.height]: local.toast.height ? `${local.toast.height}px` : undefined,
      };
    },
  };

  const contextValue: ToastRootContext = {
    toast: () => local.toast as ToastObject<any>,
    setTitleId,
    setDescriptionId,
    visibleIndex,
    expanded,
    recalculateHeight,
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref, (element: HTMLDivElement | null) => {
      rootElement = element;
      refApi.current = element;
    }),
  });

  return (
    <ToastRootContext value={contextValue}>
      <RenderElement
        as={as}
        state={state}
        props={[rootProps, elementProps, refProps]}
        stateAttributesMapping={toastRootStateAttributesMapping}
      />
    </ToastRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<ToastRoot.Props>);

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
}

export type ToastRootProps<T extends ValidComponent = "div"> = ToastRootOwnProps & RebaseUIComponentProps<T, ToastRootState>;

export namespace ToastRoot {
  export type ToastObject<Data extends object = any> = ToastRootToastObject<Data>;
  export type State = ToastRootState;
  export type Props<T extends ValidComponent = "div"> = ToastRootProps<T>;
  export type OwnProps = ToastRootOwnProps;
}
