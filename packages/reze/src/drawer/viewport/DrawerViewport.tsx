import { isElement } from "@floating-ui/utils/dom";
import { clamp } from "@rebase-ui/core/clamp";
import { dynamicElement, effect, omitProps, onCleanup, store, untrack, type JSX } from "reze-js";

import { useDialogPortalContext } from "../../dialog/portal/DialogPortalContext";
import { useDialogRootContext } from "../../dialog/root/DialogRootContext";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { activeElement, contains, getTarget } from "../../internals/floating/utils/element";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
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
const SWIPE_IGNORE_ATTRIBUTE = "data-base-ui-swipe-ignore";
const SWIPE_IGNORE_SELECTOR = `[${SWIPE_IGNORE_ATTRIBUTE}],[data-swipe-ignore]`;
const AXIS_SWIPE_IGNORE_SELECTORS: Record<ScrollAxis, string> = {
  horizontal: `[${SWIPE_IGNORE_ATTRIBUTE}="x"]`,
  vertical: `[${SWIPE_IGNORE_ATTRIBUTE}="y"]`,
};

interface TouchScrollState {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  scrollTarget: HTMLElement | null;
  hasCrossAxisGestureTarget: boolean;
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
export function DrawerViewport<T extends JSX.ElementType = "div">(props: DrawerViewport.Props<T>) {
  const rest = omitProps(props, "as", "children", "class", "style", "ref");
  // Deliberately not hoisted: viewport children must be created inside the viewport
  // context provider (and the Content branch) below, not in this body.

  const dialog = useDialogRootContext();
  const keepMounted = useDialogPortalContext();

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
    useDrawerSnapPoints(dialog);

  const visualStateStore = providerContext?.visualStateStore;

  function nestedDrawerOpen(): boolean {
    return dialog.nestedOpenDrawerCount() > 0;
  }

  const scrollAxis: ScrollAxis = swipeDirection === "left" || swipeDirection === "right" ? "horizontal" : "vertical";
  const isVerticalScrollAxis = scrollAxis === "vertical";
  const crossScrollAxis: ScrollAxis = isVerticalScrollAxis ? "horizontal" : "vertical";

  const releaseState = store({ swipeRelease: null as number | null });

  function swipeRelease(): number | null {
    return releaseState.swipeRelease;
  }

  function setSwipeRelease(next: number | null) {
    releaseState.swipeRelease = next;
  }

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

  onCleanup(() => {
    if (dismissFrame !== undefined) {
      cancelAnimationFrame(dismissFrame);
      dismissFrame = undefined;
    }
  });

  let swipingValue = false;
  let nestedSwipeActive = false;
  let lastPointerType: string = "";
  let ignoreNextTouchStartFromPen = false;
  let ignoreTouchSwipe = false;
  let touchScrollState: TouchScrollState | null = null;

  const virtualKeyboard = useDrawerVirtualKeyboardContext(true);

  function snapPointRange(): { minOffset: number; range: number } | null {
    const points = resolvedSnapPoints();
    if (!snapPoints || snapPoints.length < 2 || points.length < 2 || (swipeDirection !== "down" && swipeDirection !== "up")) {
      return null;
    }

    const offsets = points.map((point) => point.offset).sort((a, b) => a - b);

    const minOffset = offsets[0];
    const nextOffset = offsets[1];
    const range = nextOffset - minOffset;

    return { minOffset, range };
  }

  function snapPointProgress(): number | null {
    const range = snapPointRange();
    const offset = activeSnapPointOffset();
    if (!range || offset === null) {
      return null;
    }

    return clamp((offset - range.minOffset) / range.range, 0, 1);
  }

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
    untrack(dialog.popupElement)?.toggleAttribute(DrawerPopupDataAttributes.swipeDismiss, dismissed);
    untrack(dialog.backdropElement)?.toggleAttribute(DrawerPopupDataAttributes.swipeDismiss, dismissed);
  }

  function clearSwipeRelease() {
    setSwipeDismissed(false);
    untrack(dialog.popupElement)?.removeAttribute(endingStyleAttribute);
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
    const open = untrack(dialog.open);
    const nested = dialog.nested;
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

    const backdropElement = untrack(dialog.backdropElement);
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
    enabled: () => dialog.mounted() && !nestedDrawerOpen(),
    directions: swipeDirections,
    elementRef: {
      get current() {
        return untrack(dialog.popupElement);
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

      const popupElement = untrack(dialog.popupElement);

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
      setBackdropSwipingAttribute(untrack(dialog.backdropElement), swiping);

      if (!swiping && !notifyParentSwipeProgressChange) {
        finishNestedSwipe();
      }
    },
    swipeThreshold({ element, direction }) {
      return getBaseSwipeThreshold(element, direction);
    },
    canStart(position, details) {
      const popupElement = untrack(dialog.popupElement);
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

      // Over a cross-axis gesture target, stay pending until the drawer axis wins the gesture.
      // Starting on touchstart would leave the drawer swiping (and settling on release) while the
      // cross-axis target handles the drag.
      const touchState = touchScrollState;
      if (touchLike && touchState?.hasCrossAxisGestureTarget && !touchState.drawerAxisAttributed && touchState.allowSwipe !== true) {
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
        const popupElement = untrack(dialog.popupElement);
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
      const popupElement = untrack(dialog.popupElement);
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

      const backdropElement = untrack(dialog.backdropElement);
      if (backdropElement) {
        backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, "0");
        backdropElement.style.removeProperty(DrawerPopupCssVars.height);
      }

      const dismissEventDetails = createChangeEventDetails(REASONS.swipe, event);
      dialog.setOpen(false, dismissEventDetails as unknown as Parameters<typeof dialog.setOpen>[1]);

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
      if (untrack(dialog.open)) {
        const savedEvent = event;
        requestDismissFrame(() => {
          if (untrack(dialog.open)) {
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

  effect(() => {
    const root = dialog.viewportElement() ?? dialog.popupElement();
    const mounted = dialog.mounted();
    const nestedOpen = nestedDrawerOpen();
    const open = dialog.open();

    // A non-passive document listener makes all touch scrolling wait on the main thread.
    if (!root || !open || !mounted) {
      return;
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

      if (allowTouchMove || nestedOpen) {
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
    onCleanup(() => {
      doc.removeEventListener("touchmove", handleNativeTouchMove, { capture: true });
    });
  });

  effect(() => {
    const range = snapPointRange();
    const swiping = swipe.swiping();
    const open = dialog.open();
    const nested = dialog.nested;
    const progress = snapPointProgress();

    if (!range || swiping) {
      return;
    }

    untrack(() => applySwipeProgress(!open || nested ? 0 : (progress ?? 0), true, false));
  });

  effect(() => {
    const open = dialog.open();
    const notify = notifyParentSwipeProgressChange;

    if (!notify) {
      return;
    }

    if (!open) {
      untrack(() => notify(0));
    }

    onCleanup(() => {
      untrack(() => notify(0));
    });
  });

  effect(() => {
    const open = dialog.open();
    if (open) {
      untrack(() => {
        // Skip `resetSwipe` while `Drawer.SwipeArea` is driving the open: it zeroes the popup's
        // `--swipe-movement-*` (via `syncDragStyles(false)`), flashing it fully open for a frame.
        // `clearSwipeRelease` doesn't touch those vars, so always run it to clear any leftover
        // release state from a prior dismiss (e.g. when the popup is kept mounted).
        if (!swipeAreaActiveRef.current) {
          resetSwipe();
        }
        clearSwipeRelease();
      });
    }
  });

  onCleanup(() => {
    const backdropElement = untrack(dialog.backdropElement);
    visualStateStore?.set({ swipeProgress: 0, frontmostHeight: 0 });
    setBackdropSwipingAttribute(backdropElement, false);
    // `data-swiping` is set on whichever backdrop is current when a swipe starts, which can
    // differ from the captured element if the backdrop mounted late or changed identity.
    // Reading the live ref here is intentional so the current backdrop is cleared too.
    const currentBackdrop = untrack(dialog.backdropElement);
    if (currentBackdrop !== backdropElement) {
      setBackdropSwipingAttribute(currentBackdrop, false);
    }
    finishNestedSwipe();
  });

  function swipeStrength(): number | null {
    return swipeRelease();
  }

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

  function handlePointerDown(event: PointerEvent) {
    lastPointerType = event.pointerType;
    ignoreNextTouchStartFromPen = event.pointerType === "pen";

    if (!untrack(dialog.open) || !untrack(dialog.mounted) || nestedDrawerOpen()) {
      return;
    }

    const currentTarget = event.currentTarget as HTMLElement | null;
    if (!currentTarget) {
      return;
    }

    const elementAtPoint = getElementAtPoint(currentTarget.getRootNode(), event.clientX, event.clientY);
    // Pointer drags capture the pointer on press, so they can't wait to see which axis the
    // gesture takes; any `data-base-ui-swipe-ignore` value ignores them.
    if (isSwipeIgnoredTarget(elementAtPoint) || isDrawerContentTarget(elementAtPoint)) {
      return;
    }

    if (event.pointerType === "touch") {
      return;
    }

    swipePointerProps.onPointerDown?.(event);
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerType === "touch") {
      return;
    }

    swipePointerProps.onPointerMove?.(event);
  }

  function handlePointerUp(event: PointerEvent) {
    if (handlePointerEnd(event)) {
      swipePointerProps.onPointerUp?.(event);
    }
  }

  function handlePointerCancel(event: PointerEvent) {
    if (handlePointerEnd(event)) {
      swipePointerProps.onPointerCancel?.(event);
    }
  }

  function handleTouchStart(event: TouchEvent) {
    const startedFromPenPointerDown = lastPointerType === "pen" && ignoreNextTouchStartFromPen;
    if (startedFromPenPointerDown) {
      ignoreNextTouchStartFromPen = false;
      resetTouchSwipeState(false);
      return;
    }

    if (!untrack(dialog.open) || !untrack(dialog.mounted) || nestedDrawerOpen()) {
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

    // `x`/`y` hand touch drags along that axis to the element. Any value other than the
    // cross-axis one ignores the swipe outright; a cross-axis element is arbitrated like a
    // native cross-axis scroller below.
    if (elementAtPoint?.closest(`[${SWIPE_IGNORE_ATTRIBUTE}]:not(${AXIS_SWIPE_IGNORE_SELECTORS[crossScrollAxis]}),[data-swipe-ignore]`)) {
      resetTouchSwipeState(true);
      return;
    }
    ignoreTouchSwipe = false;

    const scrollTarget = findScrollableTouchTarget(target, rootElement, scrollAxis);
    const hasCrossAxisGestureTarget =
      findScrollableTouchTarget(target, rootElement, crossScrollAxis) != null ||
      elementAtPoint?.closest(AXIS_SWIPE_IGNORE_SELECTORS[crossScrollAxis]) != null;

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
      hasCrossAxisGestureTarget,
      allowSwipe,
      preserveNativeCrossAxisScroll: false,
      drawerAxisAttributed: false,
    };

    swipeTouchProps.onTouchStart?.(event);
  }

  function handleTouchEnd(event: TouchEvent) {
    virtualKeyboard?.onTouchEnd(event);
    resetTouchTrackingState();
    swipeTouchProps.onTouchEnd?.(event);
  }

  function handleTouchCancel(event: TouchEvent) {
    virtualKeyboard?.onTouchCancel();
    resetTouchTrackingState();
    swipeTouchProps.onTouchCancel?.(event);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function snapshot(): DrawerViewportState {
    return {
      open: dialog.open(),
      transitionStatus: dialog.transitionStatus(),
      nested: dialog.nested,
      nestedDialogOpen: dialog.nestedOpenDialogCount() > 0,
    };
  }

  return (
    <>
      {(keepMounted || dialog.mounted()) && (
        <Tag
          {...(rest as Record<string, unknown>)}
          role="presentation"
          hidden={!dialog.mounted() || undefined}
          onPointerDown={
            chainHandlers(props.onPointerDown as ((event: PointerEvent) => void) | undefined, handlePointerDown) as (
              event: PointerEvent,
            ) => void
          }
          onPointerMove={
            chainHandlers(props.onPointerMove as ((event: PointerEvent) => void) | undefined, handlePointerMove) as (
              event: PointerEvent,
            ) => void
          }
          onPointerUp={
            chainHandlers(props.onPointerUp as ((event: PointerEvent) => void) | undefined, handlePointerUp) as (
              event: PointerEvent,
            ) => void
          }
          onPointerCancel={
            chainHandlers(props.onPointerCancel as ((event: PointerEvent) => void) | undefined, handlePointerCancel) as (
              event: PointerEvent,
            ) => void
          }
          onTouchStart={
            chainHandlers(props.onTouchStart as ((event: TouchEvent) => void) | undefined, handleTouchStart) as (event: TouchEvent) => void
          }
          onTouchEnd={
            chainHandlers(props.onTouchEnd as ((event: TouchEvent) => void) | undefined, handleTouchEnd) as (event: TouchEvent) => void
          }
          onTouchCancel={
            chainHandlers(props.onTouchCancel as ((event: TouchEvent) => void) | undefined, handleTouchCancel) as (
              event: TouchEvent,
            ) => void
          }
          ref={mergeRefs(
            (element: HTMLElement | null) => {
              dialog.setViewportElement(element as HTMLDivElement | null);
            },
            props.ref as ((element: HTMLElement | null) => void) | undefined,
          )}
          data-open={dialog.open() ? "" : undefined}
          data-closed={dialog.open() ? undefined : ""}
          data-starting-style={dialog.transitionStatus() === "starting" ? "" : undefined}
          data-ending-style={dialog.transitionStatus() === "ending" ? "" : undefined}
          data-nested={dialog.nested ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={mergeStyleValue({ "pointer-events": dialog.open() ? undefined : "none" }, resolveStyleValue(props.style, snapshot()))}
        >
          {/* The provider lives inside the tag: context does not flow through dynamicElement,
              so providing above it would leave the popup without context. Children
              resolve in DrawerViewportContent below so they are created inside the provider. */}
          <DrawerViewportContext value={swipeProviderValue}>
            <DrawerViewportContent>{props.children}</DrawerViewportContent>
          </DrawerViewportContext>
        </Tag>
      )}
    </>
  );
}

/**
 * Resolves the viewport children inside the viewport context.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function DrawerViewportContent(props: { children: DrawerViewport.Props["children"] }) {
  return props.children as JSX.Element;
}

export interface DrawerViewportState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the drawer is nested within another drawer.
   */
  nested: boolean;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDialogOpen: boolean;
}

export interface DrawerViewportOwnProps {
  children?: JSX.Element;
  onPointerDown?: ((event: PointerEvent) => void) | undefined;
  onPointerMove?: ((event: PointerEvent) => void) | undefined;
  onPointerUp?: ((event: PointerEvent) => void) | undefined;
  onPointerCancel?: ((event: PointerEvent) => void) | undefined;
  onTouchStart?: ((event: TouchEvent) => void) | undefined;
  onTouchEnd?: ((event: TouchEvent) => void) | undefined;
  onTouchCancel?: ((event: TouchEvent) => void) | undefined;
}

export type DrawerViewportProps<T extends JSX.ElementType = "div"> = DrawerViewportOwnProps &
  RebaseUIComponentProps<T, DrawerViewportState>;

export namespace DrawerViewport {
  export type State = DrawerViewportState;
  export type Props<T extends JSX.ElementType = "div"> = DrawerViewportProps<T>;
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
 * Arbitrates a touchmove between the drawer swipe and a cross-axis gesture: a native scroll, or an
 * element marked with the cross-axis `data-base-ui-swipe-ignore` value.
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
  if (touchState.drawerAxisAttributed || touchState.allowSwipe === true || !touchState.hasCrossAxisGestureTarget) {
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
