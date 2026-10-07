import type { JSX, ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createSignal, createUniqueId, onSettled, untrack } from "solid-js";

import type { DialogRoot } from "../../dialog/root/DialogRoot";
import { useDialogRootContext } from "../../dialog/root/DialogRootContext";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { isVirtualClick } from "../../internals/floating/utils/event";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument } from "../../internals/utils/owner";
import * as DrawerBackdropCssVars from "../backdrop/DrawerBackdropCssVars";
import * as DrawerPopupCssVars from "../popup/DrawerPopupCssVars";
import * as DrawerPopupDataAttributes from "../popup/DrawerPopupDataAttributes";
import { useDrawerProviderContext } from "../provider/DrawerProviderContext";
import { useDrawerRootContext, type DrawerSwipeDirection } from "../root/DrawerRootContext";
import { createSwipeDismiss, getDisplacement, type SwipeDirection } from "../utils/createSwipeDismiss";
import { getElementTransform } from "../utils/getElementTransform";
import * as DrawerSwipeAreaDataAttributes from "./DrawerSwipeAreaDataAttributes";

const DEFAULT_SWIPE_OPEN_RATIO = 0.5;
const MIN_SWIPE_START_DISTANCE = 1;
const VELOCITY_THRESHOLD = 0.1;
const FALLBACK_SWIPE_OPEN_THRESHOLD = 40;

const OPEN_HOOK = { [DrawerSwipeAreaDataAttributes.open]: "" };
const CLOSED_HOOK = { [DrawerSwipeAreaDataAttributes.closed]: "" };
const SWIPING_HOOK = { [DrawerSwipeAreaDataAttributes.swiping]: "" };
const DISABLED_HOOK = { [DrawerSwipeAreaDataAttributes.disabled]: "" };

const stateAttributesMapping: StateAttributesMapping<DrawerSwipeAreaState> = {
  open: {
    keys: [DrawerSwipeAreaDataAttributes.open, DrawerSwipeAreaDataAttributes.closed],
    map: (value) => (value ? OPEN_HOOK : CLOSED_HOOK),
  },
  swiping: {
    keys: [DrawerSwipeAreaDataAttributes.swiping],
    map: (value) => (value ? SWIPING_HOOK : null),
  },
  swipeDirection: {
    keys: [DrawerSwipeAreaDataAttributes.swipeDirection],
    map: (value) => ({ [DrawerSwipeAreaDataAttributes.swipeDirection]: value }),
  },
  disabled: {
    keys: [DrawerSwipeAreaDataAttributes.disabled],
    map: (value) => (value ? DISABLED_HOOK : null),
  },
};

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
export function DrawerSwipeArea<T extends ValidComponent = "div">(props: DrawerSwipeArea.Props<T>) {
  const [local, elementProps] = split(props as DrawerSwipeArea.Props, { default: defaultProps }, [
    "as",
    "disabled",
    "swipeDirection",
    "id",
  ]);

  const as = untrack(() => local.as);
  const disabled = () => local.disabled ?? false;

  const store = useDialogRootContext();
  const { swipeDirection, frontmostHeight, swipeAreaActiveRef } = useDrawerRootContext();
  const providerContext = useDrawerProviderContext();

  const [swipeActive, setSwipeActive] = createSignal(false);

  let swipeAreaElement: HTMLDivElement | null = null;
  const [swipeAreaMounted, setSwipeAreaMounted] = createSignal(false);
  let swipeStartEvent: PointerEvent | TouchEvent | null = null;
  let openedBySwipe = false;
  const dragDelta = { x: 0, y: 0 };
  let closedOffset: number | null = null;
  let appliedSwipeStyles = false;
  let swipePopupElement: HTMLElement | null = null;
  let swipeBackdropElement: HTMLElement | null = null;
  let popupTransition: string | null = null;
  let releaseGuardCleanup: () => void = () => {};

  const swipeAreaId = untrack(() => local.id) ?? createUniqueId();

  // Registers the swipe area as a trigger so presses on it never dismiss the drawer.
  createEffect(
    () => ({ mounted: swipeAreaMounted() }),
    () => {
      if (!swipeAreaElement) {
        return undefined;
      }
      return store.registerTrigger(swipeAreaId, swipeAreaElement);
    },
  );

  function resetDragDelta() {
    dragDelta.x = 0;
    dragDelta.y = 0;
  }

  const resolvedSwipeDirection = untrack(() => local.swipeDirection) ?? oppositeSwipeDirection[swipeDirection];
  const dismissDirection = oppositeSwipeDirection[resolvedSwipeDirection];
  const enabled = () => !disabled() && (!store.open() || swipeActive());

  function disableDismissForSwipe() {
    releaseGuardCleanup();
    store.setOutsidePressEnabled(false);
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
      store.setOutsidePressEnabled(true);
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
    const popupElement = untrack(store.popupElement);
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
    const popupElement = untrack(store.popupElement);
    if (!popupElement) {
      return;
    }

    if (!untrack(store.open) || !untrack(store.mounted)) {
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

    const backdropElement = untrack(store.backdropElement);
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
    store.setOpen(true, createChangeEventDetails(REASONS.swipe, event, swipeAreaElement!) as DialogRoot.ChangeEventDetails);
  }

  function closeDrawer(event?: PointerEvent | TouchEvent) {
    store.setOpen(false, createChangeEventDetails(REASONS.swipe, event, swipeAreaElement!) as DialogRoot.ChangeEventDetails);
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

      if (!openedBySwipe && !untrack(store.open)) {
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
        if (!untrack(store.open)) {
          openDrawer(event);
        }
      } else if (openedBySwipe && untrack(store.open)) {
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
  createEffect(
    () => store.mounted(),
    (mounted) => {
      if (mounted && untrack(swipeActive) && appliedSwipeStyles) {
        applySwipeMovement();
      }
      return undefined;
    },
  );

  createEffect(
    () => enabled(),
    (isEnabled) => {
      if (!isEnabled) {
        if (untrack(swipeActive)) {
          enableDismissAfterRelease();
        }
        resetSwipe();
        resetDragDelta();
        clearSwipeStyles();
        resetSwipeInteractionState();
      }
      return undefined;
    },
  );

  onSettled(() => {
    return () => {
      releaseGuardCleanup();
      store.setOutsidePressEnabled(true);
    };
  });

  const state: DrawerSwipeAreaState = {
    open: store.open,
    swiping: swipe.swiping,
    swipeDirection: () => resolvedSwipeDirection,
    disabled,
  };

  const swipeAreaProps = {
    role: "presentation" as const,
    "aria-hidden": "true" as const,
    get id() {
      return swipeAreaId;
    },
    get style() {
      return {
        "pointer-events": !enabled() ? "none" : undefined,
        "touch-action": resolveTouchAction(resolvedSwipeDirection),
      } satisfies JSX.CSSProperties;
    },
    onPointerDown(event: PointerEvent) {
      if (event.pointerType === "touch") {
        return;
      }
      swipePointerProps.onPointerDown?.(event);

      // Prevent native text selection/drag gestures from competing with swipe-open dragging.
      if (event.cancelable) {
        event.preventDefault();
      }
    },
    onPointerMove(event: PointerEvent) {
      if (event.pointerType === "touch") {
        return;
      }
      swipePointerProps.onPointerMove?.(event);
    },
    onPointerUp(event: PointerEvent) {
      if (event.pointerType === "touch") {
        return;
      }
      swipePointerProps.onPointerUp?.(event);
    },
    onPointerCancel(event: PointerEvent) {
      if (event.pointerType === "touch") {
        return;
      }
      swipePointerProps.onPointerCancel?.(event);
    },
  };

  const refProps = (externalProps: Record<string, any>) => ({
    ref: mergeRefs<HTMLDivElement>(externalProps.ref, (element: HTMLDivElement | null) => {
      swipeAreaElement = element;
      setSwipeAreaMounted(element !== null);
    }),
  });

  return (
    <RenderElement
      as={as}
      state={state}
      props={[swipeAreaProps, swipeTouchProps, elementProps, refProps]}
      stateAttributesMapping={stateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "div",
  disabled: false,
} satisfies Partial<DrawerSwipeArea.Props>);

export interface DrawerSwipeAreaState {
  /**
   * Whether the drawer is currently open.
   */
  open: Accessor<boolean>;
  /**
   * Whether the swipe area is currently being swiped.
   */
  swiping: Accessor<boolean>;
  /**
   * The swipe direction that opens the drawer.
   */
  swipeDirection: Accessor<SwipeDirection>;
  /**
   * Whether the swipe area is disabled.
   */
  disabled: Accessor<boolean>;
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
}

export type DrawerSwipeAreaProps<T extends ValidComponent = "div"> = DrawerSwipeAreaOwnProps &
  RebaseUIComponentProps<T, DrawerSwipeAreaState>;

export namespace DrawerSwipeArea {
  export type State = DrawerSwipeAreaState;
  export type Props<T extends ValidComponent = "div"> = DrawerSwipeAreaProps<T>;
  export type OwnProps = DrawerSwipeAreaOwnProps;
}
