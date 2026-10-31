import type { ValidComponent } from "@solidjs/web";
import { createEffect, createMemo, createSignal, flush, onCleanup, Show, untrack } from "solid-js";

import { CompositeItem } from "../../internals/composite";
import { createButton } from "../../internals/create-button";
import { createAnimationsFinishedRunner } from "../../internals/createAnimationsFinishedRunner";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { createClick } from "../../internals/floating/interactions/createClick";
import { createDismiss } from "../../internals/floating/interactions/createDismiss";
import { createHoverFloatingInteraction } from "../../internals/floating/interactions/createHoverFloatingInteraction";
import {
  applySafePolygonPointerEventsMutation,
  clearSafePolygonPointerEventsMutation,
  createHoverInteractionSharedState,
} from "../../internals/floating/interactions/createHoverInteractionSharedState";
import { createHoverReferenceInteraction } from "../../internals/floating/interactions/createHoverReferenceInteraction";
import type { HandleCloseContextBase } from "../../internals/floating/interactions/createHoverShared";
import { safePolygon } from "../../internals/floating/safePolygon";
import { useFloatingTree } from "../../internals/floating/tree/FloatingTree";
import { useFloatingRootContext } from "../../internals/floating/useFloatingRootContext";
import { contains, getTarget } from "../../internals/floating/utils/element";
import { stopEvent } from "../../internals/floating/utils/event";
import { getNextTabbable, getPreviousTabbable, getTabbableNearElement, isOutsideEvent } from "../../internals/floating/utils/tabbable";
import { FocusGuard } from "../../internals/focus-guard/FocusGuard";
import { mergeRefs } from "../../internals/mergeRefs";
import { getRootFloatingContext } from "../../internals/popups/popupStoreUtils";
import { split } from "../../internals/split";
import { TransitionStatusDataAttributes } from "../../internals/transition-status";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { getCssDimensions } from "../../internals/utils/getCssDimensions";
import { visuallyHidden } from "../../internals/utils/visuallyHidden";
import { useNavigationMenuItemContext } from "../item/NavigationMenuItemContext";
import * as NavigationMenuPopupCssVars from "../popup/NavigationMenuPopupCssVars";
import * as NavigationMenuPositionerCssVars from "../positioner/NavigationMenuPositionerCssVars";
import type { NavigationMenuRoot } from "../root/NavigationMenuRoot";
import { useNavigationMenuRootContext, useNavigationMenuTreeContext } from "../root/NavigationMenuRootContext";
import { NAVIGATION_MENU_TRIGGER_IDENTIFIER } from "../utils/constants";
import { isOutsideMenuEvent } from "../utils/isOutsideMenuEvent";
import { setSharedFixedSize } from "../utils/setSharedFixedSize";
import { pressableTriggerOpenStateMapping } from "../utils/stateAttributesMapping";

const DEFAULT_SIZE = { width: 0, height: 0 };
const PATIENT_CLICK_THRESHOLD = 500;

class Frame {
  private id: number | undefined;

  request(fn: () => void) {
    this.cancel();
    this.id = requestAnimationFrame(() => {
      this.id = undefined;
      fn();
    });
  }

  cancel() {
    if (this.id !== undefined) {
      cancelAnimationFrame(this.id);
      this.id = undefined;
    }
  }
}

function setAutoSizes(element: HTMLElement) {
  element.style.setProperty(NavigationMenuPopupCssVars.popupWidth, "auto");
  element.style.setProperty(NavigationMenuPopupCssVars.popupHeight, "auto");
}

function clearFixedSizes(popup: HTMLElement, positioner: HTMLElement) {
  popup.style.removeProperty(NavigationMenuPopupCssVars.popupWidth);
  popup.style.removeProperty(NavigationMenuPopupCssVars.popupHeight);
  positioner.style.removeProperty(NavigationMenuPositionerCssVars.positionerWidth);
  positioner.style.removeProperty(NavigationMenuPositionerCssVars.positionerHeight);
}

function getPlacementFromElements(domReferenceElement: Element, floatingElement: HTMLElement): HandleCloseContextBase["placement"] {
  const referenceRect = domReferenceElement.getBoundingClientRect();
  const floatingRect = floatingElement.getBoundingClientRect();
  const deltaX = floatingRect.left + floatingRect.width / 2 - (referenceRect.left + referenceRect.width / 2);
  const deltaY = floatingRect.top + floatingRect.height / 2 - (referenceRect.top + referenceRect.height / 2);

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? "right" : "left";
  }

  return deltaY >= 0 ? "bottom" : "top";
}

/**
 * Opens the navigation menu popup when hovered or clicked, revealing the
 * associated content.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Navigation Menu](https://rebase-ui.knst.dev/components/navigation-menu)
 */
export function NavigationMenuTrigger<T extends ValidComponent = "button">(props: NavigationMenuTrigger.Props<T>) {
  const [local, elementProps] = split(props as NavigationMenuTrigger.Props, { default: defaultProps }, ["as", "nativeButton", "disabled"]);

  const as = untrack(() => local.as);
  const disabled = () => local.disabled as boolean;

  const root = useNavigationMenuRootContext();
  const { value, setValue, mounted, open, positionerElement, popupElement, viewportElement, transitionStatus, nested, currentContent } =
    root;
  const item = useNavigationMenuItemContext();
  const nodeId = useNavigationMenuTreeContext();
  const tree = useFloatingTree();

  const mutationFrame = new Frame();
  const resizeFrame = new Frame();
  const sizeFrame = new Frame();
  let stickIfOpenTimeout: ReturnType<typeof setTimeout> | undefined;

  const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null>(null, { ownedWrite: true });
  const triggerElementRef: { current: HTMLElement | null } = { current: null };

  let stickIfOpen = true;
  let pointerType = "";
  let prevSize = DEFAULT_SIZE;
  let skipAutoSizeSync = false;

  const isActiveItem = createMemo(() => open() && value() === item.value());
  const hoverFloatingElement = createMemo(() => positionerElement() || viewportElement());
  const interactionsEnabled = () => (positionerElement() != null || value() == null) && !disabled();
  const hoverInteractionsEnabled = () => (hoverFloatingElement() != null || value() == null) && !disabled();

  const runOnceAnimationsFinish = createAnimationsFinishedRunner(popupElement);

  function cancelAutoSizeReset(force = false) {
    const reset = root.popupAutoSizeResetRef.current;
    if (!force && reset.owner !== untrack(item.value)) {
      return;
    }

    reset.abortController?.abort();
    reset.abortController = null;
    reset.owner = null;
  }

  createEffect(isActiveItem, (active) => {
    if (!active) {
      mutationFrame.cancel();
      sizeFrame.cancel();
      cancelAutoSizeReset();
    }
  });

  function scheduleAutoSizeReset(popup: HTMLElement) {
    cancelAutoSizeReset(true);

    const abortController = new AbortController();
    const reset = root.popupAutoSizeResetRef.current;
    reset.abortController = abortController;
    reset.owner = untrack(item.value);

    runOnceAnimationsFinish(() => {
      reset.abortController = null;
      reset.owner = null;
      setAutoSizes(popup);
    }, abortController.signal);
  }

  function handleValueChange(popup: HTMLElement, positioner: HTMLElement, currentWidth: number, currentHeight: number) {
    cancelAutoSizeReset(true);
    clearFixedSizes(popup, positioner);

    const { width, height } = getCssDimensions(popup);
    const measuredWidth = width || prevSize.width;
    const measuredHeight = height || prevSize.height;

    if (currentHeight === 0 || currentWidth === 0) {
      currentWidth = measuredWidth;
      currentHeight = measuredHeight;
    }

    popup.style.setProperty(NavigationMenuPopupCssVars.popupWidth, `${currentWidth}px`);
    popup.style.setProperty(NavigationMenuPopupCssVars.popupHeight, `${currentHeight}px`);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerWidth, `${measuredWidth}px`);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerHeight, `${measuredHeight}px`);

    sizeFrame.request(() => {
      if (!untrack(isActiveItem)) {
        return;
      }

      popup.style.setProperty(NavigationMenuPopupCssVars.popupWidth, `${measuredWidth}px`);
      popup.style.setProperty(NavigationMenuPopupCssVars.popupHeight, `${measuredHeight}px`);
      scheduleAutoSizeReset(popup);
    });
  }

  function handleInterruptedMutationResize(popup: HTMLElement, positioner: HTMLElement, currentWidth: number, currentHeight: number) {
    sizeFrame.cancel();
    mutationFrame.cancel();
    cancelAutoSizeReset(true);

    if (currentWidth === 0 || currentHeight === 0) {
      return;
    }

    setSharedFixedSize(popup, positioner, currentWidth, currentHeight);

    mutationFrame.request(() => {
      mutationFrame.request(() => {
        clearFixedSizes(popup, positioner);

        const { width, height } = getCssDimensions(popup);
        const measuredWidth = width || currentWidth;
        const measuredHeight = height || currentHeight;

        setSharedFixedSize(popup, positioner, currentWidth, currentHeight);

        sizeFrame.request(() => {
          if (!untrack(isActiveItem)) {
            return;
          }

          setSharedFixedSize(popup, positioner, measuredWidth, measuredHeight);
          scheduleAutoSizeReset(popup);
        });
      });
    });
  }

  function syncCurrentSize(popup: HTMLElement, positioner: HTMLElement) {
    sizeFrame.cancel();
    cancelAutoSizeReset(true);
    clearFixedSizes(popup, positioner);

    const { width, height } = getCssDimensions(popup);

    if (width === 0 || height === 0) {
      return;
    }

    prevSize = { width, height };
    setAutoSizes(popup);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerWidth, `${width}px`);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerHeight, `${height}px`);
  }

  function getMutationBaseline(popup: HTMLElement) {
    const popupWidth = popup.style.getPropertyValue(NavigationMenuPopupCssVars.popupWidth);
    const popupHeight = popup.style.getPropertyValue(NavigationMenuPopupCssVars.popupHeight);
    const isResizing = popupWidth !== "" && popupWidth !== "auto" && popupHeight !== "" && popupHeight !== "auto";

    if (!isResizing) {
      return { size: prevSize, syncPositioner: false };
    }

    return {
      size: {
        width: popup.offsetWidth || prevSize.width,
        height: popup.offsetHeight || prevSize.height,
      },
      syncPositioner: true,
    };
  }

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      clearTimeout(stickIfOpenTimeout);
      mutationFrame.cancel();
      resizeFrame.cancel();
      sizeFrame.cancel();
      cancelAutoSizeReset(true);
      skipAutoSizeSync = false;
      pointerType = "";
    }
  });

  createEffect(mounted, (isMounted) => {
    if (!isMounted) {
      prevSize = DEFAULT_SIZE;
    }
  });

  createEffect(popupElement, (popup) => {
    if (!popup || typeof ResizeObserver !== "function") {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      prevSize = { width: popup.offsetWidth, height: popup.offsetHeight };
    });

    resizeObserver.observe(popup);

    return () => {
      resizeObserver.disconnect();
    };
  });

  createEffect(
    () => ({ active: isActiveItem(), popup: popupElement(), positioner: positionerElement() }),
    ({ active, popup, positioner }) => {
      if (!active || !popup || !positioner) {
        return undefined;
      }

      const win = positioner.ownerDocument.defaultView ?? window;
      function handleResize() {
        resizeFrame.request(() => syncCurrentSize(popup as HTMLElement, positioner as HTMLElement));
      }

      win.addEventListener("resize", handleResize);

      return () => {
        resizeFrame.cancel();
        win.removeEventListener("resize", handleResize);
      };
    },
  );

  createEffect(
    () => ({ observed: currentContent(), popup: popupElement(), positioner: positionerElement(), active: isActiveItem() }),
    ({ observed, popup, positioner, active }) => {
      if (!observed || !popup || !positioner || !active || typeof MutationObserver !== "function") {
        return undefined;
      }

      const mutationObserver = new MutationObserver(() => {
        if (untrack(transitionStatus) === "starting" || popup.hasAttribute(TransitionStatusDataAttributes.startingStyle)) {
          syncCurrentSize(popup, positioner);
          return;
        }

        const { size, syncPositioner } = getMutationBaseline(popup);

        if (syncPositioner) {
          handleInterruptedMutationResize(popup, positioner, size.width, size.height);
          return;
        }

        handleValueChange(popup, positioner, size.width, size.height);
      });

      mutationObserver.observe(observed, {
        childList: true,
        subtree: true,
        characterData: true,
        // `keepMounted` submenu switches update dimensions by toggling hidden
        // content rather than inserting or removing content nodes.
        attributes: true,
        attributeFilter: ["hidden"],
      });

      return () => {
        mutationObserver.disconnect();
      };
    },
  );

  createEffect(
    () => ({ active: isActiveItem(), popup: popupElement(), positioner: positionerElement(), status: transitionStatus() }),
    ({ active, popup, positioner }) => {
      if (active && popup && positioner) {
        if (skipAutoSizeSync) {
          skipAutoSizeSync = false;
          return;
        }

        const { width, height } = getCssDimensions(popup);
        handleValueChange(popup, positioner, width, height);
      }
    },
  );

  function handleOpenChange(nextOpen: boolean, eventDetails: RebaseUIChangeEventDetails<string>) {
    const isHover = eventDetails.reason === REASONS.triggerHover;

    if (!untrack(interactionsEnabled)) {
      return;
    }

    if (pointerType === "touch" && isHover) {
      return;
    }

    if (!nextOpen && untrack(value) !== untrack(item.value)) {
      return;
    }

    if (isHover) {
      // Only allow "patient" clicks to close the popup if it's open.
      // If they clicked within 500ms of the popup opening, keep it open.
      stickIfOpen = true;
      clearTimeout(stickIfOpenTimeout);
      stickIfOpenTimeout = setTimeout(() => {
        stickIfOpen = false;
      }, PATIENT_CLICK_THRESHOLD);
    }

    const details = eventDetails as RebaseUIChangeEventDetails<NavigationMenuRoot.ChangeEventReason>;

    if (nextOpen) {
      setValue(untrack(item.value), details);
    } else {
      setValue(null, details);
      pointerType = "";
    }

    if (isHover) {
      flush();
    }
  }

  // Each trigger owns a floating root whose `open` follows its own item, so only the active
  // trigger's hover and dismiss interactions run and upstream's active-store swap isn't needed.
  const store = untrack(() => useFloatingRootContext({ open: isActiveItem, onOpenChange: handleOpenChange }));
  const context = getRootFloatingContext(store);

  createEffect(
    () => ({ trigger: triggerElement(), floating: hoverFloatingElement() }),
    ({ trigger, floating }) => {
      store.update({ referenceElement: trigger, domReferenceElement: trigger, floatingElement: floating });
    },
  );

  const hoverInteractionState = createHoverInteractionSharedState(store);

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      store.context.dataRef.current.openEvent = undefined;
      hoverInteractionState.pointerType = undefined;
      hoverInteractionState.interactedInside = false;
      hoverInteractionState.restTimeoutPending = false;
      hoverInteractionState.openChangeTimeout.clear();
      hoverInteractionState.restTimeout.clear();
    }
  });

  onCleanup(() => {
    clearTimeout(stickIfOpenTimeout);
    mutationFrame.cancel();
    resizeFrame.cancel();
    sizeFrame.cancel();
    clearSafePolygonPointerEventsMutation(hoverInteractionState);
  });

  function getScope() {
    if (nested && untrack(positionerElement)) {
      return null;
    }

    return triggerElementRef.current?.closest("ul") ?? null;
  }

  const hover = createHoverReferenceInteraction(context, {
    move: false,
    handleClose: safePolygon({ blockPointerEvents: true, getScope }),
    restMs: () => untrack(() => (mounted() && positionerElement() ? 0 : root.delay())),
    delay: () => ({ close: untrack(root.closeDelay) }),
    triggerElementRef,
    shouldOpen: () => untrack(hoverInteractionsEnabled),
    getHandleCloseContext() {
      const floating = untrack(hoverFloatingElement);
      if (!nested || untrack(positionerElement) || !triggerElementRef.current || !floating) {
        return null;
      }

      return {
        placement: getPlacementFromElements(triggerElementRef.current, floating),
        elements: { domReference: triggerElementRef.current, floating },
        nodeId,
      };
    },
  });

  createHoverFloatingInteraction(context, {
    closeDelay: () => untrack(root.closeDelay),
    nodeId,
  });

  const dismiss = createDismiss(context, {
    outsidePressEvent: "intentional",
    outsidePress(event) {
      // A press on the list that holds this trigger stays inside the menu.
      const target = getTarget(event) as Element | null;
      return (
        target?.closest(`[${NAVIGATION_MENU_TRIGGER_IDENTIFIER}]`) == null && !contains(triggerElementRef.current?.closest("ul"), target)
      );
    },
  });

  const click = createClick(context, { stickIfOpen: () => stickIfOpen });

  createEffect(
    () => ({ active: isActiveItem(), trigger: triggerElement() }),
    ({ active, trigger }) => {
      if (active) {
        root.setActiveTrigger(trigger);
        root.prevTriggerElementRef.current = trigger;
      }
    },
  );

  function handleActivation(event: MouseEvent | KeyboardEvent) {
    const trigger = triggerElementRef.current;
    const prevTriggerRect = root.prevTriggerElementRef.current?.getBoundingClientRect();
    const currentValue = untrack(value);
    const itemValue = untrack(item.value);

    if (untrack(mounted) && prevTriggerRect && trigger) {
      const nextTriggerRect = trigger.getBoundingClientRect();
      const isMovingRight = nextTriggerRect.left > prevTriggerRect.left;
      const isMovingDown = nextTriggerRect.top > prevTriggerRect.top;
      const orientation = untrack(root.orientation);

      if (orientation === "horizontal" && nextTriggerRect.left !== prevTriggerRect.left) {
        root.setActivationDirection(isMovingRight ? "right" : "left");
      } else if (orientation === "vertical" && nextTriggerRect.top !== prevTriggerRect.top) {
        root.setActivationDirection(isMovingDown ? "down" : "up");
      }
    }

    // Reset the `openEvent` to `undefined` when the active item changes so that a
    // `click` -> `hover` on new trigger -> `hover` back to old trigger doesn't unexpectedly
    // cause the popup to remain stuck open when leaving the old trigger.
    if (event.type !== "click" && currentValue != null) {
      store.context.dataRef.current.openEvent = undefined;
    }

    if (pointerType === "touch" && event.type !== "click") {
      flush();
      return;
    }

    // Keyboard open events reach this activation path after `onKeyDown` has already set
    // the value with the `listNavigation` reason.
    if (currentValue != null && event.type !== "keydown") {
      setValue(itemValue, createChangeEventDetails(event.type === "mouseenter" ? REASONS.triggerHover : REASONS.triggerPress, event));
    }

    flush();

    const floating = untrack(hoverFloatingElement);
    if (event.type === "mouseenter" && pointerType !== "touch" && (!nested || !untrack(positionerElement)) && floating && trigger) {
      const applyPointerEventsMutation = () => {
        applySafePolygonPointerEventsMutation(hoverInteractionState, {
          scopeElement: getScope() ?? trigger.ownerDocument.body,
          referenceElement: trigger,
          floatingElement: floating,
        });
      };

      if (currentValue != null && currentValue !== itemValue) {
        queueMicrotask(applyPointerEventsMutation);
      } else {
        applyPointerEventsMutation();
      }
    }
  }

  function handleOpenEvent(event: MouseEvent | KeyboardEvent) {
    if (untrack(disabled)) {
      return;
    }

    const popup = untrack(popupElement);
    const positioner = untrack(positionerElement);

    if (!popup || !positioner) {
      handleActivation(event);
      return;
    }

    const { width, height } = getCssDimensions(popup);
    const currentValue = untrack(value);
    const shouldSkipAutoSizeSync =
      currentValue != null && currentValue !== untrack(item.value) && (event.type === "click" || pointerType !== "touch");

    handleActivation(event);

    if (shouldSkipAutoSizeSync) {
      skipAutoSizeSync = true;
    }

    handleValueChange(popup, positioner, width, height);
  }

  const state: NavigationMenuTriggerState = {
    get open() {
      return isActiveItem();
    },
    get disabled() {
      return disabled();
    },
  };

  const triggerProps = {
    get "aria-expanded"() {
      return isActiveItem() ? ("true" as const) : ("false" as const);
    },
    get "aria-controls"() {
      return isActiveItem() ? popupElement()?.id : undefined;
    },
    [NAVIGATION_MENU_TRIGGER_IDENTIFIER]: "",
  };

  const handlerProps = (externalProps: Record<string, any>) => ({
    onMouseEnter(event: MouseEvent) {
      externalProps.onMouseEnter?.(event);
      handleOpenEvent(event);
    },
    onClick(event: MouseEvent) {
      externalProps.onClick?.(event);
      // Moving from another open item is handled by the activation; toggling would close it again.
      const switchingItem = untrack(value) != null && !untrack(isActiveItem);
      handleOpenEvent(event);
      if (!switchingItem) {
        click.reference().onClick(event);
      }
      dismiss.reference().onClick?.(event);
    },
    onPointerEnter(event: PointerEvent) {
      externalProps.onPointerEnter?.(event);
      pointerType = event.pointerType;
      hover?.onPointerEnter(event);
    },
    onPointerDown(event: PointerEvent) {
      externalProps.onPointerDown?.(event);
      pointerType = event.pointerType;
      clearSafePolygonPointerEventsMutation(hoverInteractionState);
      click.reference().onPointerDown(event);
      hover?.onPointerDown(event);
      dismiss.reference().onPointerDown?.(event);
    },
    onMouseDown(event: MouseEvent) {
      externalProps.onMouseDown?.(event);
      click.reference().onMouseDown(event);
    },
    onMouseMove(event: MouseEvent) {
      externalProps.onMouseMove?.(event);
      hover?.onMouseMove(event);
    },
    onFocus(event: FocusEvent) {
      externalProps.onFocus?.(event);
      if (untrack(isActiveItem)) {
        root.setViewportInert(false);
      }
    },
    onMouseLeave(event: MouseEvent) {
      externalProps.onMouseLeave?.(event);
      if (untrack(value) == null) {
        clearSafePolygonPointerEventsMutation(hoverInteractionState);
      }
    },
    onKeyDown(event: KeyboardEvent) {
      externalProps.onKeyDown?.(event);
      click.reference().onKeyDown();
      dismiss.reference().onKeyDown?.(event);

      // For nested (submenu) triggers, don't intercept arrow keys that are used for
      // navigation in the parent content.
      if (nested) {
        return;
      }

      const trigger = triggerElementRef.current as HTMLElement;
      const verticalOpenKey = getComputedStyle(trigger).direction === "rtl" ? "ArrowLeft" : "ArrowRight";
      const orientation = untrack(root.orientation);
      const openHorizontal = orientation === "horizontal" && event.key === "ArrowDown";
      const openVertical = orientation === "vertical" && event.key === verticalOpenKey;

      if (openHorizontal || openVertical) {
        setValue(untrack(item.value), createChangeEventDetails(REASONS.listNavigation, event));
        handleOpenEvent(event);
        stopEvent(event);
      }
    },
    onBlur(event: FocusEvent) {
      externalProps.onBlur?.(event);
      const popup = untrack(popupElement);
      if (
        untrack(positionerElement) &&
        popup &&
        isOutsideMenuEvent(
          { currentTarget: triggerElementRef.current, relatedTarget: event.relatedTarget as Element | null },
          { popupElement: popup, rootElement: untrack(root.rootElement), tree, nodeId },
        )
      ) {
        setValue(null, createChangeEventDetails(REASONS.focusOut, event));
      }
    },
    ref: mergeRefs<HTMLElement>(externalProps.ref, buttonRef, (element: HTMLElement | null) => {
      triggerElementRef.current = element;
      setTriggerElement(element);
    }),
  });

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    focusableWhenDisabled: true,
    native: () => local.nativeButton as boolean,
  });

  return (
    <>
      <CompositeItem
        as={as}
        state={state}
        stateAttributesMapping={pressableTriggerOpenStateMapping}
        props={[triggerProps, elementProps, handlerProps, getButtonProps]}
      />
      <Show when={isActiveItem()}>
        <FocusGuard
          guardRef={root.beforeOutsideRef}
          onFocus={(event) => {
            const reference = untrack(hoverFloatingElement);
            if (reference && isOutsideEvent(event, reference)) {
              root.beforeInsideRef.current?.focus();
            } else {
              (getPreviousTabbable(triggerElementRef.current) as HTMLElement | null)?.focus();
            }
          }}
        />
        <span aria-owns={viewportElement()?.id} style={visuallyHidden} />
        <FocusGuard
          guardRef={root.afterOutsideRef}
          onFocus={(event) => {
            const reference = untrack(hoverFloatingElement);
            if (reference && isOutsideEvent(event, reference)) {
              root.setViewportInert(false);
              flush();
              (root.afterInsideRef.current || triggerElementRef.current)?.focus();
            } else {
              let nextTabbable = getNextTabbable(triggerElementRef.current);
              const hasPositioner = untrack(positionerElement) != null;

              if (nested && !hasPositioner && reference && nextTabbable && contains(reference, nextTabbable)) {
                nextTabbable = getTabbableNearElement(root.afterInsideRef.current, 1);
              }

              (nextTabbable as HTMLElement | null)?.focus();

              if ((!nested || hasPositioner) && !contains(untrack(root.rootElement), nextTabbable)) {
                setValue(null, createChangeEventDetails(REASONS.focusOut, event));
              }
            }
          }}
        />
      </Show>
    </>
  );
}

const defaultProps = Object.freeze({
  as: "button",
  nativeButton: true,
  disabled: false,
} satisfies Partial<NavigationMenuTrigger.Props>);

export interface NavigationMenuTriggerState {
  /**
   * If `true`, the popup is open and the item is active.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface NavigationMenuTriggerOwnProps extends NativeButtonProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type NavigationMenuTriggerProps<T extends ValidComponent = "button"> = NavigationMenuTriggerOwnProps &
  RebaseUIComponentProps<T, NavigationMenuTriggerState>;

export namespace NavigationMenuTrigger {
  export type State = NavigationMenuTriggerState;
  export type Props<T extends ValidComponent = "button"> = NavigationMenuTriggerProps<T>;
}
