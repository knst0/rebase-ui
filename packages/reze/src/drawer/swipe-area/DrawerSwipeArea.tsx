import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, store, untrack, type JSX } from "reze-js";

import type { DialogRoot } from "../../dialog/root/DialogRoot";
import { useDialogRootContext } from "../../dialog/root/DialogRootContext";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { isVirtualClick } from "../../internals/floating/utils/event";
import { mergeRefs } from "../../internals/mergeRefs";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument } from "../../internals/utils/owner";
import * as DrawerBackdropCssVars from "../backdrop/DrawerBackdropCssVars";
import * as DrawerPopupCssVars from "../popup/DrawerPopupCssVars";
import * as DrawerPopupDataAttributes from "../popup/DrawerPopupDataAttributes";
import { useDrawerProviderContext } from "../provider/DrawerProviderContext";
import { useDrawerRootContext, type DrawerSwipeDirection } from "../root/DrawerRootContext";
import { createSwipeDismiss, getDisplacement, type SwipeDirection } from "../utils/createSwipeDismiss";
import { getElementTransform } from "../utils/getElementTransform";

const DEFAULT_SWIPE_OPEN_RATIO = 0.5;
const MIN_SWIPE_START_DISTANCE = 1;
const VELOCITY_THRESHOLD = 0.1;
const FALLBACK_SWIPE_OPEN_THRESHOLD = 40;

const oppositeSwipeDirection: Record<DrawerSwipeDirection, DrawerSwipeDirection> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function resolveTouchAction(direction: DrawerSwipeDirection) {
  return direction === "left" || direction === "right" ? "pan-y" : "pan-x";
}

/**
 * An invisible area that listens for swipe gestures to open the drawer.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Drawer](https://rebase-ui.knst.dev/components/drawer)
 */
export function DrawerSwipeArea<T extends JSX.ElementType = "div">(props: DrawerSwipeArea.Props<T>) {
  const rest = omitProps(props, "as", "disabled", "swipeDirection", "id", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  function disabled(): boolean {
    return props.disabled ?? false;
  }

  const dialog = useDialogRootContext();
  const { swipeDirection, frontmostHeight, swipeAreaActiveRef } = useDrawerRootContext();
  const providerContext = useDrawerProviderContext();

  const state = store({ swipeActive: false });

  function swipeActive(): boolean {
    return state.swipeActive;
  }

  function setSwipeActive(next: boolean) {
    if (state.swipeActive !== next) {
      state.swipeActive = next;
    }
  }

  let swipeAreaElement: HTMLDivElement | null = null;
  let swipeStartEvent: PointerEvent | TouchEvent | null = null;
  let openedBySwipe = false;
  const dragDelta = { x: 0, y: 0 };
  let closedOffset: number | null = null;
  let appliedSwipeStyles = false;
  let swipePopupElement: HTMLElement | null = null;
  let swipeBackdropElement: HTMLElement | null = null;
  let popupTransition: string | null = null;
  let releaseGuardCleanup: () => void = () => {};

  const swipeAreaId = props.id ?? createUniqueId();

  function resetDragDelta() {
    dragDelta.x = 0;
    dragDelta.y = 0;
  }

  const resolvedSwipeDirection = props.swipeDirection ?? oppositeSwipeDirection[swipeDirection];
  const dismissDirection = oppositeSwipeDirection[resolvedSwipeDirection];

  function enabled(): boolean {
    return !disabled() && (!dialog.open() || swipeActive());
  }

  function disableDismissForSwipe() {
    releaseGuardCleanup();
    dialog.setOutsidePressEnabled(false);
  }

  function enableDismissAfterRelease() {
    releaseGuardCleanup();

    const doc = ownerDocument(swipeAreaElement);

    function restore(event?: MouseEvent) {
      // The gesture's trailing release click is the one physical click with no `pointerdown` of
      // its own. Ignore it and keep waiting, so it cannot dismiss the drawer it just opened,
      // while a click-only activation (keyboard or assistive tech) still re-enables in time.
      if (event?.type === "click" && event.detail !== 0 && !isVirtualClick(event)) {
        return;
      }

      releaseGuardCleanup = () => {};
      doc.removeEventListener("pointerdown", restore, true);
      doc.removeEventListener("click", restore, true);
      dialog.setOutsidePressEnabled(true);
    }

    // The pointerup that ends a swipe-open gesture synthesizes a `click`. When the drag released
    // outside the popup (e.g. it was dragged past the popup's size), that click would be treated as
    // an outside press and immediately dismiss the drawer that was just opened. Keep outside-press
    // dismissal disabled until the next interaction that isn't that release click: a deliberate
    // outside press starts with a `pointerdown`, and a click-only activation (keyboard or
    // assistive tech) is distinguishable from a physical release. This is deterministic, unlike
    // re-enabling on a timer that can race the synthesized click and dismiss at random.
    //
    // `restore` runs in document capture, ahead of the dialog's own outside-press check (which
    // happens on the event target, after capture), so the triggering press still dismisses.
    releaseGuardCleanup = restore;
    doc.addEventListener("pointerdown", restore, true);
    doc.addEventListener("click", restore, true);
  }

  function getPopupSize(popupElement: HTMLElement) {
    const isHorizontal = dismissDirection === "left" || dismissDirection === "right";
    const size = isHorizontal ? popupElement.offsetWidth : popupElement.offsetHeight;
    if (size <= 0) {
      return null;
    }

    return size;
  }

  function resolvePopupSize() {
    const popupElement = untrack(dialog.popupElement);
    return popupElement ? getPopupSize(popupElement) : null;
  }

  function resolveClosedOffset(popupElement: HTMLElement) {
    const offset = getPopupSize(popupElement);
    if (offset == null) {
      return null;
    }

    const isHorizontal = dismissDirection === "left" || dismissDirection === "right";
    const transform = getElementTransform(popupElement);
    const transformOffset = isHorizontal ? transform.x : transform.y;
    if (Number.isFinite(transformOffset) && Math.abs(transformOffset) > 0.5) {
      return Math.min(offset, Math.abs(transformOffset));
    }

    return offset;
  }

  function resolveSwipeOpenThreshold() {
    const popupSize = resolvePopupSize();
    if (popupSize == null) {
      return FALLBACK_SWIPE_OPEN_THRESHOLD;
    }

    return popupSize * DEFAULT_SWIPE_OPEN_RATIO;
  }

  function applySwipeMovement() {
    const popupElement = untrack(dialog.popupElement);
    if (!popupElement) {
      return;
    }

    if (!untrack(dialog.open) || !untrack(dialog.mounted)) {
      return;
    }

    if (closedOffset == null) {
      closedOffset = resolveClosedOffset(popupElement);
    }

    const resolvedClosedOffset = closedOffset;
    if (resolvedClosedOffset === null) {
      return;
    }

    const { x, y } = dragDelta;
    const displacement = getDisplacement(resolvedSwipeDirection, x, y);
    const clampedDisplacement = Math.max(0, displacement);
    const dampedDisplacement =
      clampedDisplacement > resolvedClosedOffset
        ? resolvedClosedOffset + Math.sqrt(clampedDisplacement - resolvedClosedOffset)
        : clampedDisplacement;
    const remaining = resolvedClosedOffset - dampedDisplacement;
    const directionSign = dismissDirection === "left" || dismissDirection === "up" ? -1 : 1;
    const movement = remaining * directionSign;
    const isHorizontal = dismissDirection === "left" || dismissDirection === "right";
    const movementX = isHorizontal ? movement : 0;
    const movementY = isHorizontal ? 0 : movement;
    const openProgress = Math.max(0, Math.min(1, clampedDisplacement / resolvedClosedOffset));
    const backdropProgress = Math.max(0, Math.min(1, 1 - openProgress));

    popupElement.style.setProperty(DrawerPopupCssVars.swipeMovementX, `${movementX}px`);
    popupElement.style.setProperty(DrawerPopupCssVars.swipeMovementY, `${movementY}px`);
    popupElement.setAttribute(DrawerPopupDataAttributes.swiping, "");
    swipePopupElement = popupElement;
    if (popupTransition === null) {
      popupTransition = popupElement.style.transition;
    }
    popupElement.style.transition = "none";

    const backdropElement = untrack(dialog.backdropElement);
    if (backdropElement) {
      backdropElement.setAttribute(DrawerPopupDataAttributes.swiping, "");
      swipeBackdropElement = backdropElement;
      backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${backdropProgress}`);
      const currentFrontmostHeight = untrack(frontmostHeight);
      if (openProgress > 0 && currentFrontmostHeight > 0) {
        backdropElement.style.setProperty(DrawerPopupCssVars.height, `${currentFrontmostHeight}px`);
      } else {
        backdropElement.style.removeProperty(DrawerPopupCssVars.height);
      }
    }

    providerContext?.visualStateStore.set({
      swipeProgress: openProgress,
      frontmostHeight: openProgress > 0 ? untrack(frontmostHeight) : 0,
    });
    appliedSwipeStyles = true;
    swipeAreaActiveRef.current = true;
  }

  function clearSwipeStyles() {
    const popupElement = swipePopupElement;
    if (popupElement) {
      popupElement.style.removeProperty(DrawerPopupCssVars.swipeMovementX);
      popupElement.style.removeProperty(DrawerPopupCssVars.swipeMovementY);
      popupElement.removeAttribute(DrawerPopupDataAttributes.swiping);
    }

    if (popupElement && popupTransition !== null) {
      popupElement.style.transition = popupTransition;
      popupTransition = null;
    }

    const backdropElement = swipeBackdropElement;
    if (backdropElement) {
      backdropElement.removeAttribute(DrawerPopupDataAttributes.swiping);
      backdropElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, "0");
      backdropElement.style.removeProperty(DrawerPopupCssVars.height);
    }

    providerContext?.visualStateStore.set({ swipeProgress: 0, frontmostHeight: 0 });
    appliedSwipeStyles = false;
    swipePopupElement = null;
    swipeBackdropElement = null;
    swipeAreaActiveRef.current = false;
  }

  function openDrawer(event?: PointerEvent | TouchEvent) {
    openedBySwipe = true;
    dialog.setOpen(true, createChangeEventDetails(REASONS.swipe, event, swipeAreaElement!) as DialogRoot.ChangeEventDetails);
  }

  function closeDrawer(event?: PointerEvent | TouchEvent) {
    dialog.setOpen(false, createChangeEventDetails(REASONS.swipe, event, swipeAreaElement!) as DialogRoot.ChangeEventDetails);
  }

  function resetSwipeInteractionState() {
    swipeStartEvent = null;
    openedBySwipe = false;
    closedOffset = null;
    setSwipeActive(false);
  }

  function finishSwipeInteraction() {
    resetSwipeInteractionState();
    enableDismissAfterRelease();
    resetDragDelta();
    clearSwipeStyles();
  }

  const swipe = createSwipeDismiss({
    enabled,
    directions: [resolvedSwipeDirection],
    elementRef: {
      get current() {
        return swipeAreaElement;
      },
    },
    trackDrag: false,
    movementCssVars: {
      x: DrawerPopupCssVars.swipeMovementX,
      y: DrawerPopupCssVars.swipeMovementY,
    },
    onSwipeStart(event) {
      disableDismissForSwipe();
      swipeStartEvent = event;
      openedBySwipe = false;
      setSwipeActive(true);
      resetDragDelta();
    },
    onProgress(_progress, details) {
      if (!details) {
        return;
      }

      if (!swipeStartEvent) {
        return;
      }

      dragDelta.x = details.deltaX;
      dragDelta.y = details.deltaY;

      if (details.direction !== resolvedSwipeDirection) {
        return;
      }

      const displacement = getDisplacement(resolvedSwipeDirection, details.deltaX, details.deltaY);
      if (!openedBySwipe && displacement < MIN_SWIPE_START_DISTANCE) {
        return;
      }

      if (!openedBySwipe && !untrack(dialog.open)) {
        openDrawer(swipeStartEvent);
      }

      applySwipeMovement();
    },
    onRelease({ event, direction, deltaX, deltaY, releaseVelocityX, releaseVelocityY }) {
      const displacement = getDisplacement(resolvedSwipeDirection, deltaX, deltaY);
      const releaseVelocity = getDisplacement(resolvedSwipeDirection, releaseVelocityX, releaseVelocityY);
      const threshold = resolveSwipeOpenThreshold();
      const hasEnoughDistance = displacement >= threshold;
      const hasEnoughVelocity = releaseVelocity >= VELOCITY_THRESHOLD;
      const shouldOpen = direction === resolvedSwipeDirection && (hasEnoughDistance || hasEnoughVelocity) && !untrack(disabled);

      if (shouldOpen) {
        if (!untrack(dialog.open)) {
          openDrawer(event);
        }
      } else if (openedBySwipe && untrack(dialog.open)) {
        closeDrawer(event);
      }

      finishSwipeInteraction();

      return false;
    },
    onCancel: finishSwipeInteraction,
  });

  const swipePointerProps = swipe.getPointerProps();
  const swipeTouchProps = swipe.getTouchProps();
  const resetSwipe = swipe.reset;

  // The commit that opens the drawer re-renders the popup, resetting `--swipe-movement-*` to `0px`
  // (the viewport isn't swiping). Re-assert after the popup mounts but before paint.
  effect(() => {
    const mounted = dialog.mounted();
    if (mounted && untrack(swipeActive) && appliedSwipeStyles) {
      applySwipeMovement();
    }
  });

  effect(() => {
    const isEnabled = enabled();
    if (!isEnabled) {
      untrack(() => {
        if (swipeActive()) {
          enableDismissAfterRelease();
        }
        resetSwipe();
        resetDragDelta();
        clearSwipeStyles();
        resetSwipeInteractionState();
      });
    }
  });

  onCleanup(() => {
    releaseGuardCleanup();
    dialog.setOutsidePressEnabled(true);
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType === "touch") {
      return;
    }
    swipePointerProps.onPointerDown?.(event);

    // Prevent native text selection/drag gestures from competing with swipe-open dragging.
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerType === "touch") {
      return;
    }
    swipePointerProps.onPointerMove?.(event);
  }

  function handlePointerUp(event: PointerEvent) {
    if (event.pointerType === "touch") {
      return;
    }
    swipePointerProps.onPointerUp?.(event);
  }

  function handlePointerCancel(event: PointerEvent) {
    if (event.pointerType === "touch") {
      return;
    }
    swipePointerProps.onPointerCancel?.(event);
  }

  function snapshot(): DrawerSwipeAreaState {
    return {
      open: dialog.open(),
      swiping: swipe.swiping(),
      swipeDirection: resolvedSwipeDirection,
      disabled: disabled(),
    };
  }

  // Registers the swipe area as a trigger so presses on it never dismiss the drawer.
  let unregisterTrigger: (() => void) | undefined;
  onCleanup(() => {
    unregisterTrigger?.();
    unregisterTrigger = undefined;
  });

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      role="presentation"
      aria-hidden="true"
      id={swipeAreaId}
      onPointerDown={(props.onPointerDown ?? handlePointerDown) as (event: PointerEvent) => void}
      onPointerMove={(props.onPointerMove ?? handlePointerMove) as (event: PointerEvent) => void}
      onPointerUp={(props.onPointerUp ?? handlePointerUp) as (event: PointerEvent) => void}
      onPointerCancel={(props.onPointerCancel ?? handlePointerCancel) as (event: PointerEvent) => void}
      onTouchStart={(props.onTouchStart ?? swipeTouchProps.onTouchStart) as (event: TouchEvent) => void}
      onTouchMove={(props.onTouchMove ?? swipeTouchProps.onTouchMove) as (event: TouchEvent) => void}
      onTouchEnd={(props.onTouchEnd ?? swipeTouchProps.onTouchEnd) as (event: TouchEvent) => void}
      onTouchCancel={(props.onTouchCancel ?? swipeTouchProps.onTouchCancel) as (event: TouchEvent) => void}
      ref={mergeRefs(
        (element: HTMLElement | null) => {
          unregisterTrigger?.();
          unregisterTrigger = undefined;
          swipeAreaElement = element as HTMLDivElement | null;
          if (swipeAreaElement !== null) {
            unregisterTrigger = dialog.registerTrigger(swipeAreaId, swipeAreaElement);
          }
        },
        props.ref as ((element: HTMLElement | null) => void) | undefined,
      )}
      data-open={dialog.open() ? "" : undefined}
      data-closed={dialog.open() ? undefined : ""}
      data-swiping={swipe.swiping() ? "" : undefined}
      data-swipe-direction={resolvedSwipeDirection}
      data-disabled={disabled() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={mergeStyleValue(
        { "pointer-events": !enabled() ? "none" : undefined, "touch-action": resolveTouchAction(resolvedSwipeDirection) },
        resolveStyleValue(props.style, snapshot()),
      )}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface DrawerSwipeAreaState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * Whether the swipe area is currently being swiped.
   */
  swiping: boolean;
  /**
   * The swipe direction that opens the drawer.
   */
  swipeDirection: SwipeDirection;
  /**
   * Whether the swipe area is disabled.
   */
  disabled: boolean;
}

export interface DrawerSwipeAreaOwnProps {
  /**
   * Whether the swipe area is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The swipe direction that opens the drawer.
   * Defaults to the opposite of `Drawer.Root` `swipeDirection`.
   */
  swipeDirection?: DrawerSwipeDirection | undefined;
  /**
   * ID of the swipe area. Registers it as a trigger so presses on it never dismiss the drawer.
   */
  id?: string | undefined;
  onPointerDown?: ((event: PointerEvent) => void) | undefined;
  onPointerMove?: ((event: PointerEvent) => void) | undefined;
  onPointerUp?: ((event: PointerEvent) => void) | undefined;
  onPointerCancel?: ((event: PointerEvent) => void) | undefined;
  onTouchStart?: ((event: TouchEvent) => void) | undefined;
  onTouchMove?: ((event: TouchEvent) => void) | undefined;
  onTouchEnd?: ((event: TouchEvent) => void) | undefined;
  onTouchCancel?: ((event: TouchEvent) => void) | undefined;
}

export type DrawerSwipeAreaProps<T extends JSX.ElementType = "div"> = DrawerSwipeAreaOwnProps &
  RebaseUIComponentProps<T, DrawerSwipeAreaState>;

export namespace DrawerSwipeArea {
  export type State = DrawerSwipeAreaState;
  export type Props<T extends JSX.ElementType = "div"> = DrawerSwipeAreaProps<T>;
  export type OwnProps = DrawerSwipeAreaOwnProps;
}
