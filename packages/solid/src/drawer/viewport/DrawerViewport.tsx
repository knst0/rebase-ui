import { isElement } from "@floating-ui/utils/dom";
import { clamp } from "@rebase-ui/core/clamp";
import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createSignal, onSettled, untrack } from "solid-js";

import * as DialogPopupDataAttributes from "../../dialog/popup/DialogPopupDataAttributes";
import { useDialogRootContext } from "../../dialog/root/DialogRootContext";
import { DialogViewport } from "../../dialog/viewport/DialogViewport";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { activeElement, contains, getTarget } from "../../internals/floating/utils/element";
import { split } from "../../internals/split";
import type { TransitionStatus } from "../../internals/transition-status";
import { endingStyle as endingStyleAttribute } from "../../internals/transition-status/TransitionStatusDataAttributes";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument } from "../../internals/utils/owner";
import * as DrawerBackdropCssVars from "../backdrop/DrawerBackdropCssVars";
import { DRAWER_CONTENT_ATTRIBUTE } from "../content/drawerContentAttribute";
import * as DrawerPopupCssVars from "../popup/DrawerPopupCssVars";
import * as DrawerPopupDataAttributes from "../popup/DrawerPopupDataAttributes";
import { useDrawerProviderContext } from "../provider/DrawerProviderContext";
import { useDrawerRootContext } from "../root/DrawerRootContext";
import {
  closestSnapPointIndex,
  getSnapPointSwipeMovement,
  useDrawerSnapPoints,
  type ResolvedDrawerSnapPoint,
} from "../root/useDrawerSnapPoints";
import { createSwipeDismiss, getDisplacement, type SwipeDirection, type SwipeDismissProgressDetails } from "../utils/createSwipeDismiss";
import { getElementAtPoint } from "../utils/getElementAtPoint";
import { findScrollableTouchTarget, type ScrollAxis } from "../utils/scrollable";
import { useDrawerVirtualKeyboardContext } from "../virtual-keyboard-provider/DrawerVirtualKeyboardContext";
import { DrawerViewportContext } from "./DrawerViewportContext";

const MIN_SWIPE_THRESHOLD = 10;
const FAST_SWIPE_VELOCITY = 0.5;
const SNAP_VELOCITY_THRESHOLD = 0.5;
const SNAP_VELOCITY_MULTIPLIER = 300;
const MAX_SNAP_VELOCITY = 4;
const MIN_SWIPE_RELEASE_VELOCITY = 0.2;
const MAX_SWIPE_RELEASE_VELOCITY = 4;
const MIN_SWIPE_RELEASE_DURATION_MS = 80;
const MAX_SWIPE_RELEASE_DURATION_MS = 360;
const MIN_SWIPE_RELEASE_SCALAR = 0.1;
const MAX_SWIPE_RELEASE_SCALAR = 1;
const AXIS_LOCK_SLOP = 6;
const AXIS_LOCK_BIAS = 2;
const DRAWER_CONTENT_SELECTOR = `[${DRAWER_CONTENT_ATTRIBUTE}]`;
const SWIPE_IGNORE_SELECTOR = "[data-base-ui-swipe-ignore],[data-swipe-ignore]";

interface TouchScrollState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  scrollTarget: HTMLElement | null;
  hasCrossAxisScrollableContent: boolean;
  allowSwipe: boolean | null;
  preserveNativeCrossAxisScroll: boolean;
  drawerAxisAttributed: boolean;
}

/**
 * A positioning container for the drawer popup that can be made scrollable.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerViewport<T extends ValidComponent = "div">(props: DrawerViewport.Props<T>) {
  const [local, elementProps] = split(props as DrawerViewport.Props, { default: defaultProps }, ["as", "children"]);

  const as = untrack(() => local.as);

  const store = useDialogRootContext();

  const {
    swipeDirection,
    notifyParentSwipingChange,
    notifyParentSwipeProgressChange,
    frontmostHeight,
    snapToSequentialPoints,
    swipeAreaActiveRef,
  } = useDrawerRootContext();
  const providerContext = useDrawerProviderContext();
  const { snapPoints, resolvedSnapPoints, activeSnapPoint, activeSnapPointOffset, setActiveSnapPoint, popupHeight } =
    useDrawerSnapPoints(store);

  const visualStateStore = providerContext?.visualStateStore;
  const nestedDrawerOpen = () => store.nestedOpenDrawerCount() > 0;
  const scrollAxis: ScrollAxis = swipeDirection === "left" || swipeDirection === "right" ? "horizontal" : "vertical";
  const isVerticalScrollAxis = scrollAxis === "vertical";
  const crossScrollAxis: ScrollAxis = isVerticalScrollAxis ? "horizontal" : "vertical";

  const [swipeRelease, setSwipeRelease] = createSignal<number | null>(null);

  let pendingSwipeCloseSnapPoint: DrawerViewport.PendingSnapPoint = undefined;
  let resetSwipeRef: (() => void) | null = null;
  let dismissFrame: number | undefined;

  function requestDismissFrame(fn: () => void) {
    if (dismissFrame !== undefined) {
      cancelAnimationFrame(dismissFrame);
    }
    dismissFrame = requestAnimationFrame(() => {
      dismissFrame = undefined;
      fn();
    });
  }

  onSettled(() => {
    return () => {
      if (dismissFrame !== undefined) {
        cancelAnimationFrame(dismissFrame);
        dismissFrame = undefined;
      }
    };
  });

  let swipingValue = false;
  let nestedSwipeActive = false;
  let lastPointerType: string | "" = "";
  let ignoreNextTouchStartFromPen = false;
  let ignoreTouchSwipe = false;
  let touchScrollState: TouchScrollState | null = null;

  const virtualKeyboard = useDrawerVirtualKeyboardContext(true);

  const snapPointRange = createMemo(() => {
    const points = resolvedSnapPoints();
    if (!snapPoints || snapPoints.length < 2 || points.length < 2 || (swipeDirection !== "down" && swipeDirection !== "up")) {
      return null;
    }

    const offsets = points.map((point) => point.offset).sort((a, b) => a - b);

    const minOffset = offsets[0];
    const nextOffset = offsets[1];
    const range = nextOffset - minOffset;

    return { minOffset, range };
  });

  const snapPointProgress = createMemo(() => {
    const range = snapPointRange();
    const offset = activeSnapPointOffset();
    if (!range || offset === null) {
      return null;
    }

    return clamp((offset - range.minOffset) / range.range, 0, 1);
  });

  // Structural: swipe directions are fixed for the lifetime of the instance.
  // A plain array (not a memo): reading a memo here would be a one-shot
  // untracked read in the component body.
  const swipeDirections: SwipeDirection[] =
    snapPoints && snapPoints.length > 0 && (swipeDirection === "down" || swipeDirection === "up")
      ? swipeDirection === "down"
        ? ["down", "up"]
        : ["up", "down"]
      : [swipeDirection];

  function setSwipeDismissed(dismissed: boolean) {
    untrack(store.popupElement)?.toggleAttribute(DrawerPopupDataAttributes.swipeDismiss, dismissed);
    untrack(store.backdropElement)?.toggleAttribute(DrawerPopupDataAttributes.swipeDismiss, dismissed);
  }

  function clearSwipeRelease() {
    setSwipeDismissed(false);
    untrack(store.popupElement)?.removeAttribute(endingStyleAttribute);
    setSwipeRelease(null);
  }

  function finishNestedSwipe() {
    if (!nestedSwipeActive) {
      return;
    }

    nestedSwipeActive = false;
    notifyParentSwipingChange?.(false);
  }

  function applySwipeProgress(resolvedProgress: number, shouldTrackProgress: boolean, notifyParent: boolean) {
    const open = untrack(store.open);
    const nested = store.nested;
    const isActive = open && !nested && shouldTrackProgress;
    const swipeProgress = isActive ? resolvedProgress : 0;
    const nestedSwipeProgress = open && shouldTrackProgress ? resolvedProgress : 0;

    if (notifyParent && notifyParentSwipeProgressChange) {
      notifyParentSwipeProgressChange(nestedSwipeProgress);

      if (nestedSwipeProgress <= 0) {
        finishNestedSwipe();
      }
    }

    const currentFrontmostHeight = untrack(frontmostHeight);
    visualStateStore?.set({
      swipeProgress,
      frontmostHeight: swipeProgress > 0 ? currentFrontmostHeight : 0,
    });

    const backdropElement = untrack(store.backdropElement);
    if (!backdropElement) {
      return;
    }

    const showProgress = isActive && swipeProgress > 0;
    backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, showProgress ? `${swipeProgress}` : "0");
    if (showProgress && currentFrontmostHeight > 0) {
      backdropElement.style.setProperty(DrawerPopupCssVars.height, `${currentFrontmostHeight}px`);
    } else {
      backdropElement.style.removeProperty(DrawerPopupCssVars.height);
    }
  }

  function resolveSwipeRelease(
    popupElement: HTMLElement,
    direction: SwipeDirection,
    deltaX: number,
    deltaY: number,
    velocityX: number,
    velocityY: number,
    releaseVelocityX: number,
    releaseVelocityY: number,
  ): number | null {
    const size = getBaseSwipeSize(popupElement, direction);
    if (size <= 0) {
      return null;
    }

    // The snap point base offset shifts the popup along the dismiss direction for both
    // `down` (+offset) and `up` (-offset), so it always adds to the directional translation.
    const snapPointBaseOffset =
      (direction === "down" || direction === "up") && snapPoints && snapPoints.length > 0 ? (activeSnapPointOffset() ?? 0) : 0;
    const translationAlongDirection = snapPointBaseOffset + getDisplacement(direction, deltaX, deltaY);
    const remainingDistance = Math.max(0, size - translationAlongDirection);
    if (remainingDistance <= 0) {
      return null;
    }

    const releaseVelocity = getDisplacement(direction, releaseVelocityX, releaseVelocityY);
    const directionalVelocity = Math.abs(releaseVelocity) > 0 ? releaseVelocity : getDisplacement(direction, velocityX, velocityY);
    if (directionalVelocity <= MIN_SWIPE_RELEASE_VELOCITY) {
      return null;
    }

    const clampedVelocity = clamp(directionalVelocity, MIN_SWIPE_RELEASE_VELOCITY, MAX_SWIPE_RELEASE_VELOCITY);
    // The gesture hook supplies finite deltas and velocities. The guards above keep the remaining
    // distance and divisor positive, so the duration stays within [MIN, MAX] and the resulting
    // scalar within (0, 1].
    const durationMs = clamp(remainingDistance / clampedVelocity, MIN_SWIPE_RELEASE_DURATION_MS, MAX_SWIPE_RELEASE_DURATION_MS);
    const normalizedDuration =
      (durationMs - MIN_SWIPE_RELEASE_DURATION_MS) / (MAX_SWIPE_RELEASE_DURATION_MS - MIN_SWIPE_RELEASE_DURATION_MS);
    return MIN_SWIPE_RELEASE_SCALAR + normalizedDuration * (MAX_SWIPE_RELEASE_SCALAR - MIN_SWIPE_RELEASE_SCALAR);
  }

  function updateNestedSwipeActive(details?: SwipeDismissProgressDetails) {
    if (nestedSwipeActive || !details) {
      return;
    }

    const direction = details.direction ?? swipeDirection;
    const delta = getDisplacement(direction, details.deltaX, details.deltaY);
    if (Math.abs(delta) < MIN_SWIPE_THRESHOLD) {
      return;
    }

    nestedSwipeActive = true;
    notifyParentSwipingChange?.(true);
  }

  const swipe = createSwipeDismiss({
    enabled: () => store.mounted() && !nestedDrawerOpen(),
    directions: swipeDirections,
    elementRef: {
      get current() {
        return untrack(store.popupElement);
      },
    },
    ignoreSelectorWhenTouch: false,
    ignoreScrollableAncestors: true,
    movementCssVars: {
      x: DrawerPopupCssVars.swipeMovementX,
      y: DrawerPopupCssVars.swipeMovementY,
    },
    onSwipeStart(event) {
      if ("touches" in event || (event as PointerEvent).pointerType === "touch") {
        return;
      }

      const popupElement = untrack(store.popupElement);

      const doc = ownerDocument(popupElement);
      const selection = doc.getSelection?.();
      if (!selection || selection.isCollapsed) {
        return;
      }

      const anchorElement = isElement(selection.anchorNode) ? selection.anchorNode : selection.anchorNode?.parentElement;
      const focusElement = isElement(selection.focusNode) ? selection.focusNode : selection.focusNode?.parentElement;

      if (!contains(popupElement, anchorElement) && !contains(popupElement, focusElement)) {
        return;
      }

      selection.removeAllRanges();
    },
    onSwipingChange(swiping) {
      swipingValue = swiping;
      setBackdropSwipingAttribute(untrack(store.backdropElement), swiping);

      if (!swiping && !notifyParentSwipeProgressChange) {
        finishNestedSwipe();
      }
    },
    swipeThreshold({ element, direction }) {
      return getBaseSwipeThreshold(element, direction);
    },
    canStart(position, details) {
      const popupElement = untrack(store.popupElement);
      if (!popupElement) {
        return false;
      }

      const doc = popupElement.ownerDocument;
      const elementAtPoint = getElementAtPoint(popupElement.getRootNode(), position.x, position.y);
      if (!elementAtPoint || !contains(popupElement, elementAtPoint)) {
        return false;
      }

      const nativeEvent = details.nativeEvent;
      const touchLike = "touches" in nativeEvent || (nativeEvent as PointerEvent).pointerType === "touch";
      if (touchLike && shouldIgnoreSwipeForTextSelection(doc, popupElement)) {
        return false;
      }

      return true;
    },
    onProgress(progress, details) {
      const swiping = swipingValue;

      if (swiping) {
        updateNestedSwipeActive(details);
      }

      const hasSnapPoints = Boolean(snapPoints && snapPoints.length > 0);
      if (swiping && swipeDirection === "down" && hasSnapPoints && details) {
        const popupElement = untrack(store.popupElement);
        if (popupElement) {
          popupElement.style.removeProperty("transform");
          popupElement.style.setProperty(
            DrawerPopupCssVars.swipeMovementY,
            `${getSnapPointSwipeMovement(activeSnapPointOffset() ?? 0, details.deltaY)}px`,
          );
        }
      }

      let resolvedProgress = progress;
      const range = untrack(snapPointRange);
      const currentPopupHeight = untrack(popupHeight);
      if (range && currentPopupHeight > 0) {
        const baseOffset = activeSnapPointOffset() ?? range.minOffset;
        const offsetToProgress = (nextOffset: number) => clamp((nextOffset - range.minOffset) / range.range, 0, 1);

        // Outside a drag the hook still reports the last drag deltas, both after a release and
        // on a gesture that never started (e.g. a press inside `Drawer.Content`). Recomputing
        // from them would re-apply drag progress to a drawer that rests on its snap point.
        if (swiping && details && Number.isFinite(details.deltaY)) {
          resolvedProgress = offsetToProgress(clamp(baseOffset + details.deltaY, 0, currentPopupHeight));
        } else {
          const restingProgress = untrack(snapPointProgress);
          if (restingProgress !== null) {
            resolvedProgress = restingProgress;
          }
        }
      }

      // A parent drawer follows an active drag only, so drop it back to zero once the drag ends.
      if (!swiping) {
        notifyParentSwipeProgressChange?.(0);
        finishNestedSwipe();
      }

      applySwipeProgress(resolvedProgress, true, swiping);
    },
    onRelease({ event, deltaX, deltaY, direction, velocityX, velocityY, releaseVelocityX, releaseVelocityY }) {
      const popupElement = untrack(store.popupElement);
      if (!popupElement) {
        clearSwipeRelease();
        return undefined;
      }
      const releasePopupElement = popupElement;

      function startSwipeRelease(resolvedDirection: SwipeDirection) {
        // Start ending transition styles earlier and synchronously to prevent a period where
        // the popup appears stuck on release before the actual closing animation starts.
        finishNestedSwipe();
        setSwipeDismissed(true);

        releasePopupElement.style.removeProperty("transition");
        releasePopupElement.setAttribute(endingStyleAttribute, "");
        setSwipeRelease(
          resolveSwipeRelease(
            releasePopupElement,
            resolvedDirection,
            deltaX,
            deltaY,
            velocityX,
            velocityY,
            releaseVelocityX,
            releaseVelocityY,
          ),
        );
      }

      if (!snapPoints || snapPoints.length === 0) {
        if (!direction) {
          clearSwipeRelease();
          return undefined;
        }

        const directionalDelta = getDisplacement(direction, deltaX, deltaY);
        if (directionalDelta <= 0) {
          clearSwipeRelease();
          return false;
        }

        if (getDisplacement(direction, velocityX, velocityY) >= FAST_SWIPE_VELOCITY) {
          startSwipeRelease(direction);
          return true;
        }

        const shouldClose = directionalDelta > getBaseSwipeThreshold(releasePopupElement, direction);
        if (shouldClose) {
          startSwipeRelease(direction);
        } else {
          clearSwipeRelease();
        }
        return shouldClose;
      }

      if (swipeDirection !== "down" && swipeDirection !== "up") {
        clearSwipeRelease();
        return undefined;
      }

      const currentPopupHeight = untrack(popupHeight);
      if (!currentPopupHeight) {
        clearSwipeRelease();
        return false;
      }

      const points = untrack(resolvedSnapPoints);
      if (points.length === 0) {
        clearSwipeRelease();
        return undefined;
      }

      const dragDelta = swipeDirection === "down" ? deltaY : -deltaY;
      const dragDirection = Math.sign(dragDelta);
      const releaseDirectionalVelocity = swipeDirection === "down" ? releaseVelocityY : -releaseVelocityY;
      const fallbackDirectionalVelocity = swipeDirection === "down" ? velocityY : -velocityY;
      let resolvedDirectionalVelocity = releaseDirectionalVelocity;
      if (dragDirection !== 0 && Math.abs(dragDelta) >= MIN_SWIPE_THRESHOLD) {
        const velocityDirection = Math.sign(resolvedDirectionalVelocity);
        if (velocityDirection !== 0 && velocityDirection !== dragDirection) {
          // Ignore touch reversals that would otherwise flip the snap decision.
          resolvedDirectionalVelocity = fallbackDirectionalVelocity;
        }
      }

      const currentOffset = activeSnapPointOffset() ?? 0;
      const dragTargetOffset = clamp(currentOffset + dragDelta, 0, currentPopupHeight);
      const velocityOffset =
        Math.abs(resolvedDirectionalVelocity) >= SNAP_VELOCITY_THRESHOLD
          ? clamp(resolvedDirectionalVelocity, -MAX_SNAP_VELOCITY, MAX_SNAP_VELOCITY) * SNAP_VELOCITY_MULTIPLIER
          : 0;
      const targetOffset = snapToSequentialPoints ? dragTargetOffset : clamp(dragTargetOffset + velocityOffset, 0, currentPopupHeight);
      const snapPointEventDetails = createChangeEventDetails(REASONS.swipe, event);

      const settleInPlace = () => {
        // Reset nested swipe state now: the hook's trailing progress update is deduped
        // when the drag never produced dismissal progress, so it may not fire.
        applySwipeProgress(0, true, true);
        clearSwipeRelease();
        return false;
      };

      const settleOnSnapPoint = (snapPoint: ResolvedDrawerSnapPoint) => {
        setActiveSnapPoint(snapPoint.value, snapPointEventDetails as DrawerViewport.SnapPointChangeEventDetails);
        return settleInPlace();
      };

      const closeFromSnapPoints = (fallbackSnapPoint: ResolvedDrawerSnapPoint) => {
        // An unattributed gesture (e.g. a mostly horizontal flick) may settle on a snap
        // point but must not dismiss: `createSwipeDismiss` drops a directionless dismissal,
        // stranding the popup visually closed while `open` stays `true`.
        if (!direction) {
          return settleOnSnapPoint(fallbackSnapPoint);
        }
        setActiveSnapPoint(null, snapPointEventDetails as DrawerViewport.SnapPointChangeEventDetails);
        if (snapPointEventDetails.isCanceled) {
          // A canceled null snap point rejects dismissal before exit styles start.
          return settleInPlace();
        }
        pendingSwipeCloseSnapPoint = untrack(activeSnapPoint);
        startSwipeRelease(swipeDirection);
        return true;
      };

      if (snapToSequentialPoints) {
        const orderedSnapPoints = [...points].sort((first, second) => first.offset - second.offset);
        const orderedOffsets = orderedSnapPoints.map((point) => point.offset);
        const currentIndex = closestSnapPointIndex(orderedOffsets, currentOffset);
        let targetSnapPoint = orderedSnapPoints[closestSnapPointIndex(orderedOffsets, targetOffset)];

        const velocityDirection = Math.sign(resolvedDirectionalVelocity);
        const shouldAdvance =
          dragDirection !== 0 &&
          velocityDirection !== 0 &&
          velocityDirection === dragDirection &&
          Math.abs(resolvedDirectionalVelocity) >= SNAP_VELOCITY_THRESHOLD;
        let effectiveTargetOffset = targetOffset;

        if (shouldAdvance) {
          const adjacentIndex = clamp(currentIndex + dragDirection, 0, orderedSnapPoints.length - 1);
          if (adjacentIndex !== currentIndex) {
            const adjacentPoint = orderedSnapPoints[adjacentIndex];
            const shouldForceAdjacent = dragDirection > 0 ? targetOffset < adjacentPoint.offset : targetOffset > adjacentPoint.offset;
            if (shouldForceAdjacent) {
              targetSnapPoint = adjacentPoint;
              effectiveTargetOffset = adjacentPoint.offset;
            }
          } else if (dragDirection > 0) {
            return closeFromSnapPoints(targetSnapPoint);
          }
        }

        const closeDistance = Math.abs(effectiveTargetOffset - currentPopupHeight);
        const snapDistance = Math.abs(effectiveTargetOffset - targetSnapPoint.offset);
        if (closeDistance < snapDistance) {
          return closeFromSnapPoints(targetSnapPoint);
        }

        return settleOnSnapPoint(targetSnapPoint);
      }

      const closestSnapPoint =
        points[
          closestSnapPointIndex(
            points.map((point) => point.offset),
            targetOffset,
          )
        ];

      if (resolvedDirectionalVelocity >= FAST_SWIPE_VELOCITY && dragDelta > 0) {
        return closeFromSnapPoints(closestSnapPoint);
      }

      const closeDistance = Math.abs(targetOffset - currentPopupHeight);
      if (closeDistance < Math.abs(targetOffset - closestSnapPoint.offset)) {
        return closeFromSnapPoints(closestSnapPoint);
      }

      return settleOnSnapPoint(closestSnapPoint);
    },
    onDismiss(event) {
      visualStateStore?.set({ swipeProgress: 0, frontmostHeight: 0 });

      const backdropElement = untrack(store.backdropElement);
      if (backdropElement) {
        backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, "0");
        backdropElement.style.removeProperty(DrawerPopupCssVars.height);
      }

      const dismissEventDetails = createChangeEventDetails(REASONS.swipe, event);
      store.setOpen(false, dismissEventDetails as unknown as Parameters<typeof store.setOpen>[1]);

      if (dismissEventDetails.isCanceled) {
        const pendingSnapPoint = pendingSwipeCloseSnapPoint;
        if (pendingSnapPoint !== undefined) {
          setActiveSnapPoint(
            pendingSnapPoint,
            createChangeEventDetails(REASONS.swipe, event) as DrawerViewport.SnapPointChangeEventDetails,
          );
        }

        pendingSwipeCloseSnapPoint = undefined;
        resetSwipeRef?.();
        clearSwipeRelease();
        return;
      }

      // In controlled mode, the effective open state may not have changed yet
      // (openProp takes precedence over state.open). Proceed optimistically with the
      // dismiss animation — the rAF check below verifies whether the parent accepted
      // or rejected the close.
      // Note: if onOpenChange is asynchronous (e.g., closes the drawer after a network
      // call), the rAF check will see open === true, revert the animation, and the
      // drawer will close without animation when the parent eventually sets open={false}.
      if (untrack(store.open)) {
        const savedEvent = event;
        requestDismissFrame(() => {
          if (untrack(store.open)) {
            // Parent rejected: revert animation and restore snap point.
            const pendingSnapPoint = pendingSwipeCloseSnapPoint;
            if (pendingSnapPoint !== undefined) {
              setActiveSnapPoint(
                pendingSnapPoint,
                createChangeEventDetails(REASONS.swipe, savedEvent) as DrawerViewport.SnapPointChangeEventDetails,
              );
            }
            pendingSwipeCloseSnapPoint = undefined;
            clearSwipeRelease();
            resetSwipeRef?.();
          } else {
            // Parent accepted: clean up the ref.
            pendingSwipeCloseSnapPoint = undefined;
          }
        });
        return;
      }

      pendingSwipeCloseSnapPoint = undefined;
      setSwipeDismissed(true);
    },
  });

  const swipePointerProps = swipe.getPointerProps();
  const swipeTouchProps = swipe.getTouchProps();
  const moveSwipeNative = swipe.moveNative;
  const resetSwipe = swipe.reset;

  resetSwipeRef = resetSwipe;

  createEffect(
    () => ({
      root: store.viewportElement() ?? store.popupElement(),
      mounted: store.mounted(),
      nestedOpen: nestedDrawerOpen(),
      open: store.open(),
    }),
    ({ root, mounted, nestedOpen, open }) => {
      if (!root) {
        return undefined;
      }

      const resolvedRootElement: HTMLElement = root;
      const doc = ownerDocument(resolvedRootElement);

      function processTouchMove(event: TouchEvent, touchState: TouchScrollState, touch: Touch) {
        const drawerAxisDelta = isVerticalScrollAxis ? touch.clientY - touchState.lastY : touch.clientX - touchState.lastX;

        // Avoid blocking pinch zoom or text selection adjustments on iOS Safari.
        if (event.touches.length === 2) {
          return;
        }

        const allowTouchMove = shouldIgnoreSwipeForTextSelection(doc, resolvedRootElement);

        if (allowTouchMove || !open || !mounted || nestedOpen) {
          return;
        }

        if (shouldYieldTouchMove(touchState, event, touch, isVerticalScrollAxis)) {
          return;
        }

        const scrollTarget = touchState.scrollTarget;
        if (!scrollTarget || scrollTarget === doc.documentElement || scrollTarget === doc.body) {
          if (event.cancelable) {
            event.preventDefault();
          }
          // Claim the gesture before delegated touch handlers see it; dispatching the
          // move through them re-rasterizes the popup content on every frame.
          event.stopPropagation();
          moveSwipeNative(event, resolvedRootElement);
          return;
        }

        if (!hasScrollableContentOnAxis(scrollTarget, scrollAxis)) {
          // If the scroll container doesn't overflow on the drawer axis, prevent the window from
          // scrolling instead.
          if (event.cancelable) {
            event.preventDefault();
          }
          event.stopPropagation();
          return;
        }

        if (drawerAxisDelta !== 0) {
          const canSwipeFromScrollEdge = canSwipeFromScrollEdgeOnMove(scrollTarget, scrollAxis, swipeDirection, drawerAxisDelta);

          if (!touchState.allowSwipe) {
            if (event.cancelable && canSwipeFromScrollEdge) {
              touchState.allowSwipe = true;
              event.preventDefault();
            } else {
              touchState.allowSwipe = false;
            }
          } else if (event.cancelable) {
            event.preventDefault();
          }
        }

        if (touchState.allowSwipe === true) {
          event.stopPropagation();
          moveSwipeNative(event, resolvedRootElement);
        }
      }

      function handleNativeTouchMove(event: TouchEvent) {
        // The virtual keyboard provider observes the move to tell a tap apart from a drag.
        // It must run even when the swipe gesture below claims the event with
        // `stopPropagation()`, which would otherwise prevent delegated handlers
        // (and the provider) from ever seeing the move.
        virtualKeyboard?.onTouchMove(event);

        if (ignoreTouchSwipe) {
          return;
        }

        const touchState = touchScrollState;
        const touch = event.touches[0];
        if (!touch || !touchState) {
          return;
        }

        processTouchMove(event, touchState, touch);
        updateTouchScrollPosition(touchState, touch);
      }

      doc.addEventListener("touchmove", handleNativeTouchMove, { passive: false, capture: true });
      return () => {
        doc.removeEventListener("touchmove", handleNativeTouchMove, { capture: true });
      };
    },
  );

  createEffect(
    () => ({ range: snapPointRange(), swiping: swipe.swiping(), open: store.open(), nested: store.nested, progress: snapPointProgress() }),
    ({ range, swiping, open, nested, progress }) => {
      if (!range || swiping) {
        return;
      }

      applySwipeProgress(!open || nested ? 0 : (progress ?? 0), true, false);
    },
  );

  createEffect(
    () => ({ open: store.open(), notify: notifyParentSwipeProgressChange }),
    ({ open, notify }) => {
      if (!notify) {
        return undefined;
      }

      if (!open) {
        untrack(() => notify(0));
      }

      return () => {
        untrack(() => notify(0));
      };
    },
  );

  createEffect(
    () => store.open(),
    (open) => {
      if (open) {
        // Skip `resetSwipe` while `Drawer.SwipeArea` is driving the open: it zeroes the popup's
        // `--swipe-movement-*` (via `syncDragStyles(false)`), flashing it fully open for a frame.
        // `clearSwipeRelease` doesn't touch those vars, so always run it to clear any leftover
        // release state from a prior dismiss (e.g. when the popup is kept mounted).
        if (!swipeAreaActiveRef.current) {
          resetSwipe();
        }
        clearSwipeRelease();
      }
      return undefined;
    },
  );

  onSettled(() => {
    const backdropElement = untrack(store.backdropElement);

    return () => {
      visualStateStore?.set({ swipeProgress: 0, frontmostHeight: 0 });
      setBackdropSwipingAttribute(backdropElement, false);
      // `data-swiping` is set on whichever backdrop is current when a swipe starts, which can
      // differ from the captured element if the backdrop mounted late or changed identity.
      // Reading the live ref here is intentional so the current backdrop is cleared too.
      const currentBackdrop = untrack(store.backdropElement);
      if (currentBackdrop !== backdropElement) {
        setBackdropSwipingAttribute(currentBackdrop, false);
      }
      finishNestedSwipe();
    };
  });

  const swipeStrength = () => swipeRelease();

  const swipeProviderValue = {
    swiping: swipe.swiping,
    getDragStyles: swipe.getDragStyles,
    swipeStrength,
    setSwipeDismissed,
  };

  function resetTouchSwipeState(ignoreSwipe: boolean) {
    ignoreTouchSwipe = ignoreSwipe;
    touchScrollState = null;
  }

  function resetTouchTrackingState() {
    resetTouchSwipeState(false);
    lastPointerType = "";
    ignoreNextTouchStartFromPen = false;
  }

  function handlePointerEnd(event: PointerEvent): boolean {
    lastPointerType = "";
    return event.pointerType !== "touch";
  }

  function chainHandlers<T extends Event>(
    userHandler: ((event: T) => void) | undefined,
    internalHandler: ((event: T) => void) | undefined,
  ) {
    if (!userHandler) {
      return internalHandler;
    }
    if (!internalHandler) {
      return userHandler;
    }
    return (event: T) => {
      userHandler(event);
      internalHandler(event);
    };
  }

  const userHandlers = elementProps as Record<string, ((event: any) => void) | undefined>;

  const viewportProps = {
    onPointerDown: chainHandlers<PointerEvent>(userHandlers.onPointerDown, (event) => {
      lastPointerType = event.pointerType;
      ignoreNextTouchStartFromPen = event.pointerType === "pen";

      if (!untrack(store.open) || !untrack(store.mounted) || nestedDrawerOpen()) {
        return;
      }

      const currentTarget = event.currentTarget as HTMLElement | null;
      if (!currentTarget) {
        return;
      }

      const elementAtPoint = getElementAtPoint(currentTarget.getRootNode(), event.clientX, event.clientY);
      if (isSwipeIgnoredTarget(elementAtPoint) || isDrawerContentTarget(elementAtPoint)) {
        return;
      }

      if (event.pointerType === "touch") {
        return;
      }

      swipePointerProps.onPointerDown?.(event);
    }),
    onPointerMove: chainHandlers<PointerEvent>(userHandlers.onPointerMove, (event) => {
      if (event.pointerType === "touch") {
        return;
      }

      swipePointerProps.onPointerMove?.(event);
    }),
    onPointerUp: chainHandlers<PointerEvent>(userHandlers.onPointerUp, (event) => {
      if (handlePointerEnd(event)) {
        swipePointerProps.onPointerUp?.(event);
      }
    }),
    onPointerCancel: chainHandlers<PointerEvent>(userHandlers.onPointerCancel, (event) => {
      if (handlePointerEnd(event)) {
        swipePointerProps.onPointerCancel?.(event);
      }
    }),
    onTouchStart: chainHandlers<TouchEvent>(userHandlers.onTouchStart, (event) => {
      const startedFromPenPointerDown = lastPointerType === "pen" && ignoreNextTouchStartFromPen;
      if (startedFromPenPointerDown) {
        ignoreNextTouchStartFromPen = false;
        resetTouchSwipeState(false);
        return;
      }

      if (!untrack(store.open) || !untrack(store.mounted) || nestedDrawerOpen()) {
        resetTouchSwipeState(false);
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      if (isTouchEventOnRangeInput(event)) {
        resetTouchSwipeState(false);
        return;
      }

      const rootElement = event.currentTarget as HTMLElement | null;
      if (!rootElement) {
        resetTouchSwipeState(true);
        return;
      }
      const elementAtPoint = getElementAtPoint(rootElement.getRootNode(), touch.clientX, touch.clientY);
      const eventTarget = getTarget(event);
      const target = isElement(eventTarget) ? eventTarget : rootElement;
      if (!contains(rootElement, target)) {
        resetTouchSwipeState(true);
        return;
      }

      virtualKeyboard?.onTouchStart(event);

      if (isSwipeIgnoredTarget(elementAtPoint)) {
        resetTouchSwipeState(true);
        return;
      }
      ignoreTouchSwipe = false;

      const scrollTarget = findScrollableTouchTarget(target, rootElement, scrollAxis);
      const hasCrossAxisScrollableContent = findScrollableTouchTarget(target, rootElement, crossScrollAxis) != null;

      let allowSwipe: boolean | null = null;
      if (scrollTarget) {
        const canSwipeFromEdge = isAtSwipeStartEdge(scrollTarget, scrollAxis, swipeDirection);

        allowSwipe = canSwipeFromEdge ? null : false;
      }

      touchScrollState = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        scrollTarget,
        hasCrossAxisScrollableContent,
        allowSwipe,
        preserveNativeCrossAxisScroll: false,
        drawerAxisAttributed: false,
      };

      swipeTouchProps.onTouchStart?.(event);
    }),
    onTouchEnd: chainHandlers<TouchEvent>(userHandlers.onTouchEnd, (event) => {
      virtualKeyboard?.onTouchEnd(event);
      resetTouchTrackingState();
      swipeTouchProps.onTouchEnd?.(event);
    }),
    onTouchCancel: chainHandlers<TouchEvent>(userHandlers.onTouchCancel, (event) => {
      virtualKeyboard?.onTouchCancel();
      resetTouchTrackingState();
      swipeTouchProps.onTouchCancel?.(event);
    }),
    // Drawer popups use drawer-specific nested state attributes.
    // Suppress DialogViewport's generic nested dialog attribute.
    [DialogPopupDataAttributes.nestedDialogOpen]: undefined,
  };

  // Omit the handlers and children already merged above from the props forwarded
  // to the underlying dialog viewport.
  const {
    onPointerDown: _onPointerDown,
    onPointerMove: _onPointerMove,
    onPointerUp: _onPointerUp,
    onPointerCancel: _onPointerCancel,
    onTouchStart: _onTouchStart,
    onTouchEnd: _onTouchEnd,
    onTouchCancel: _onTouchCancel,
    ...forwardedProps
  } = elementProps as Record<string, unknown>;

  return (
    <DialogViewport as={as} {...(viewportProps as JSX.CustomAttributes<HTMLDivElement>)} {...forwardedProps}>
      {/* `children` resolves here — inside the provider element, not in the body — so
          parts created from it (e.g. `<Drawer.Popup>`) observe this context. The read is
          intentionally one-shot: creating the subtree must not subscribe the viewport to
          signals the children touch while they are created. */}
      <DrawerViewportContext value={swipeProviderValue}>{untrack(() => local.children) as JSX.Element}</DrawerViewportContext>
    </DialogViewport>
  );
}

const defaultProps = Object.freeze({
  as: "div",
} satisfies Partial<DrawerViewport.Props>);

export interface DrawerViewportState {
  /**
   * Whether the drawer is currently open.
   */
  open: Accessor<boolean>;
  /**
   * The transition status of the component.
   */
  transitionStatus: Accessor<TransitionStatus>;
  /**
   * Whether the drawer is nested within another drawer.
   */
  nested: Accessor<boolean>;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDialogOpen: Accessor<boolean>;
}

export interface DrawerViewportOwnProps {
  children?: JSX.Element;
}

export type DrawerViewportProps<T extends ValidComponent = "div"> = DrawerViewportOwnProps & RebaseUIComponentProps<T, DrawerViewportState>;

export namespace DrawerViewport {
  export type State = DrawerViewportState;
  export type Props<T extends ValidComponent = "div"> = DrawerViewportProps<T>;
  export type OwnProps = DrawerViewportOwnProps;
  export type SnapPointChangeEventDetails = import("../root/DrawerRoot").DrawerRoot.SnapPointChangeEventDetails;
  export type PendingSnapPoint = import("../root/DrawerRootContext").DrawerSnapPoint | null | undefined;
}

function setBackdropSwipingAttribute(backdropElement: HTMLElement | null, swiping: boolean) {
  backdropElement?.toggleAttribute(DrawerPopupDataAttributes.swiping, swiping);
}

function isSwipeIgnoredTarget(target: Element | null): boolean {
  return Boolean(target?.closest(SWIPE_IGNORE_SELECTOR));
}

function isDrawerContentTarget(target: Element | null): boolean {
  return Boolean(target?.closest(DRAWER_CONTENT_SELECTOR));
}

function getBaseSwipeSize(element: HTMLElement, direction: SwipeDirection): number {
  return direction === "left" || direction === "right" ? element.offsetWidth : element.offsetHeight;
}

function getBaseSwipeThreshold(element: HTMLElement, direction: SwipeDirection): number {
  return Math.max(getBaseSwipeSize(element, direction) * 0.5, MIN_SWIPE_THRESHOLD);
}

function isRangeInput(target: EventTarget | null): boolean {
  return target instanceof Element && target.tagName === "INPUT" && (target as HTMLInputElement).type === "range";
}

function isTextSelectionControl(target: Element): target is HTMLInputElement | HTMLTextAreaElement {
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA";
}

function hasExpandedSelectionWithinTarget(selection: Selection, target: Element): boolean {
  const anchorElement = isElement(selection.anchorNode) ? selection.anchorNode : selection.anchorNode?.parentElement;
  const focusElement = isElement(selection.focusNode) ? selection.focusNode : selection.focusNode?.parentElement;

  return selection.containsNode(target, true) || contains(target, anchorElement) || contains(target, focusElement);
}

function shouldIgnoreSwipeForTextSelection(doc: Document, rootElement: HTMLElement): boolean {
  const activeEl = activeElement(doc);
  if (activeEl && contains(rootElement, activeEl) && isTextSelectionControl(activeEl)) {
    const { selectionStart, selectionEnd } = activeEl;
    if (selectionStart != null && selectionEnd != null && selectionStart < selectionEnd) {
      return true;
    }
  }

  const selection = doc.getSelection?.();
  if (!selection || selection.isCollapsed) {
    return false;
  }

  return hasExpandedSelectionWithinTarget(selection, rootElement);
}

function isTouchEventOnRangeInput(event: TouchEvent): boolean {
  return event.composedPath().some((pathTarget) => isRangeInput(pathTarget));
}

function updateTouchScrollPosition(touchState: TouchScrollState, touch: Touch): void {
  touchState.lastX = touch.clientX;
  touchState.lastY = touch.clientY;
}

/**
 * Arbitrates a touchmove between the drawer swipe and a native cross-axis scroll.
 * Returns `true` when the move must be left alone — either because the cross axis already won the
 * gesture, or because neither axis has passed the slop yet and the gesture cannot be attributed.
 */
function shouldYieldTouchMove(touchState: TouchScrollState, event: TouchEvent, touch: Touch, isVerticalScrollAxis: boolean): boolean {
  if (touchState.preserveNativeCrossAxisScroll) {
    return true;
  }

  // Attribution happens once per gesture. Re-arbitrating after the drawer axis has won would let
  // the pre-attribution branches below fire mid-drag (the slop is measured from the touch origin,
  // which is never re-baselined), freezing the popup and dropping `preventDefault()`.
  if (touchState.drawerAxisAttributed || touchState.allowSwipe === true || !touchState.hasCrossAxisScrollableContent) {
    return false;
  }

  // A non-cancelable touchmove means the browser has already committed the gesture to a native
  // scroll; claiming it for the swipe would drag the popup alongside the scrolling content.
  if (!event.cancelable) {
    touchState.preserveNativeCrossAxisScroll = true;
    return true;
  }

  const drawerAxisGestureDelta = isVerticalScrollAxis ? touch.clientY - touchState.startY : touch.clientX - touchState.startX;
  const crossAxisGestureDelta = isVerticalScrollAxis ? touch.clientX - touchState.startX : touch.clientY - touchState.startY;
  const absDrawerAxisGestureDelta = Math.abs(drawerAxisGestureDelta);
  const absCrossAxisGestureDelta = Math.abs(crossAxisGestureDelta);

  if (absCrossAxisGestureDelta >= AXIS_LOCK_SLOP && absCrossAxisGestureDelta > absDrawerAxisGestureDelta + AXIS_LOCK_BIAS) {
    touchState.preserveNativeCrossAxisScroll = true;
    return true;
  }

  if (absDrawerAxisGestureDelta >= AXIS_LOCK_SLOP) {
    touchState.drawerAxisAttributed = true;
    return false;
  }

  // Neither axis has traveled past the slop yet, so the gesture cannot be attributed. Leave the
  // event alone: on iOS, `preventDefault()` on the first cancelable touchmove cancels native
  // scrolling for the entire gesture, which would lock a cross-axis scroll that only passes the
  // slop on a later move.
  return true;
}

function hasScrollableContentOnAxis(scrollTarget: HTMLElement, axis: ScrollAxis): boolean {
  return getScrollMetrics(scrollTarget, axis).max > 0;
}

function getScrollMetrics(scrollTarget: HTMLElement, axis: ScrollAxis) {
  if (axis === "vertical") {
    const max = Math.max(0, scrollTarget.scrollHeight - scrollTarget.clientHeight);
    return { offset: scrollTarget.scrollTop, max };
  }

  const max = Math.max(0, scrollTarget.scrollWidth - scrollTarget.clientWidth);
  return { offset: scrollTarget.scrollLeft, max };
}

function isAtSwipeStartEdge(scrollTarget: HTMLElement, axis: ScrollAxis, direction: SwipeDirection): boolean {
  const dismissFromStartEdge = shouldDismissFromStartEdge(direction, axis);
  const { offset, max } = getScrollMetrics(scrollTarget, axis);
  return dismissFromStartEdge ? offset <= 0 : offset >= max;
}

function canSwipeFromScrollEdgeOnMove(scrollTarget: HTMLElement, axis: ScrollAxis, direction: SwipeDirection, delta: number): boolean {
  const dismissFromStartEdge = shouldDismissFromStartEdge(direction, axis);
  const movingTowardDismiss = dismissFromStartEdge ? delta > 0 : delta < 0;
  if (!movingTowardDismiss) {
    return false;
  }

  return isAtSwipeStartEdge(scrollTarget, axis, direction);
}

function shouldDismissFromStartEdge(direction: SwipeDirection, axis: ScrollAxis): boolean {
  return axis === "vertical" ? direction === "down" : direction === "right";
}
