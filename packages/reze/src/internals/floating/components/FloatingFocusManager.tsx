import { getNodeName, getWindow as ownerWindow, isHTMLElement } from "@floating-ui/utils/dom";
import { effect, onCleanup, store as createStore, untrack, type JSX } from "reze-js";

import { type RebaseUIChangeEventDetails } from "../../event-details/createEventDetails";
import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import { visuallyHidden } from "../../utils/visuallyHidden";
import { type FloatingRootStore } from "../tree/FloatingRootStore";
import { useFloatingTree } from "../tree/FloatingTree";
import { type FloatingTreeStore } from "../tree/FloatingTreeStore";
import { type FloatingContext, type FloatingUIOpenChangeDetails } from "../types";
import { isElementVisible } from "../utils/composite";
import { createAttribute } from "../utils/createAttribute";
import { activeElement, contains, getFloatingFocusElement, getTarget, isTypeableCombobox, isTypeableElement } from "../utils/element";
import { enqueueFocus } from "../utils/enqueueFocus";
import { isVirtualClick, isVirtualPointerEvent, stopEvent } from "../utils/event";
import { markOthers } from "../utils/markOthers";
import { getNodeAncestors, getNodeChildren } from "../utils/nodes";
import {
  focusable,
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
  isTabbable,
  tabbable,
  type FocusableElement,
} from "../utils/tabbable";
import { usePortalContext } from "./FloatingPortal";

// Local copy of `internals/utils/owner`'s `ownerDocument` (not yet ported to
// Reze). `ownerWindow` is imported above as floating-ui's `getWindow`, exactly
// as the Solid layer's `owner` module re-exports it.
function ownerDocument(node: Element | null) {
  return node?.ownerDocument || document;
}

// Local copy of `internals/utils/platform`'s engine detection (not yet ported
// to Reze). Only the WebKit flag is needed here.
function isWebkitEngine() {
  return typeof CSS !== "undefined" && !!CSS.supports?.("-webkit-backdrop-filter:none");
}

// No solid-side equivalent exists yet; mirrors upstream's
// `CLICK_TRIGGER_IDENTIFIER` from `../../internals/constants`.
const CLICK_TRIGGER_IDENTIFIER = "data-base-ui-click-trigger";

const focusGuardAttribute = createAttribute("focus-guard");

export type FloatingFocusManagerInteractionType = "keyboard" | "mouse" | "touch" | "pen" | "";

export type FloatingFocusTargetRef = HTMLElement | { current: Element | null };

function resolveRef(target: FloatingFocusTargetRef | null | undefined): HTMLElement | null {
  if (target == null) {
    return null;
  }
  if (target instanceof HTMLElement) {
    return target;
  }
  const current = target.current;
  return current instanceof HTMLElement ? current : null;
}

function isPointerOpenInteraction(openType: FloatingFocusManagerInteractionType | null | undefined): boolean {
  // Pointer-initiated opens (click/tap) originate from an element the user is
  // already looking at: moving focus into the popup must not scroll the page
  // (e.g. when the popup opens below the fold). Keyboard-initiated opens keep
  // the default scroll-into-view so the focused element is revealed.
  return openType === "mouse" || openType === "touch" || openType === "pen";
}

function getEventType(event: Event, lastInteractionType?: FloatingFocusManagerInteractionType): FloatingFocusManagerInteractionType {
  const win = ownerWindow(getTarget(event));
  if (event instanceof win.KeyboardEvent) {
    return "keyboard";
  }
  if (event instanceof win.FocusEvent) {
    // Focus events can be caused by a preceding pointer interaction (e.g., focusout on outside press).
    // Prefer the last known pointer type if provided, else treat as keyboard.
    return lastInteractionType || "keyboard";
  }
  if ("pointerType" in event) {
    return ((event as PointerEvent).pointerType as FloatingFocusManagerInteractionType) || "keyboard";
  }
  if ("touches" in event) {
    return "touch";
  }
  if (event instanceof win.MouseEvent) {
    // Click events may not contain pointer events, and will fall through to here.
    return lastInteractionType || (event.detail === 0 ? "keyboard" : "mouse");
  }
  return "";
}

const LIST_LIMIT = 20;
let previouslyFocusedElements: WeakRef<Element>[] = [];

function clearDisconnectedPreviouslyFocusedElements() {
  previouslyFocusedElements = previouslyFocusedElements.filter((entry) => {
    return entry.deref()?.isConnected;
  });
}

function addPreviouslyFocusedElement(element: Element | null | undefined) {
  clearDisconnectedPreviouslyFocusedElements();
  if (element && getNodeName(element) !== "body") {
    previouslyFocusedElements.push(new WeakRef(element));
    if (previouslyFocusedElements.length > LIST_LIMIT) {
      previouslyFocusedElements = previouslyFocusedElements.slice(-LIST_LIMIT);
    }
  }
}

function getPreviouslyFocusedElement() {
  clearDisconnectedPreviouslyFocusedElements();
  return previouslyFocusedElements[previouslyFocusedElements.length - 1]?.deref();
}

function getFirstTabbableElement(container: Element | null) {
  if (!container) {
    return null;
  }

  if (isTabbable(container)) {
    return container;
  }

  return tabbable(container)[0] || container;
}

function handleTabIndex(floatingFocusElement: HTMLElement) {
  if (floatingFocusElement.hasAttribute("tabindex") && !floatingFocusElement.hasAttribute("data-tabindex")) {
    return;
  }

  if (!floatingFocusElement.getAttribute("role")?.includes("dialog")) {
    return;
  }

  const focusableElements = focusable(floatingFocusElement);
  const tabbableContent = focusableElements.filter((element) => {
    const dataTabIndex = element.getAttribute("data-tabindex") || "";
    return isTabbable(element) || (element.hasAttribute("data-tabindex") && !dataTabIndex.startsWith("-"));
  });
  const tabIndex = floatingFocusElement.getAttribute("tabindex");

  if (tabbableContent.length === 0) {
    if (tabIndex !== "0") {
      floatingFocusElement.setAttribute("tabindex", "0");
      // Mark our own write so the externally-managed early-return above doesn't
      // mistake it for a user-authored `tabindex` and freeze management.
      floatingFocusElement.setAttribute("data-tabindex", "0");
    }
  } else if (
    tabIndex !== "-1" ||
    (floatingFocusElement.hasAttribute("data-tabindex") && floatingFocusElement.getAttribute("data-tabindex") !== "-1")
  ) {
    floatingFocusElement.setAttribute("tabindex", "-1");
    floatingFocusElement.setAttribute("data-tabindex", "-1");
  }
}

// Minimal `addEventListener` wrapper returning its cleanup, mirroring
// `@base-ui/utils/addEventListener` (`false` targets yield a no-op).
function listen<T extends Event>(
  target: EventTarget | null | undefined,
  type: string,
  handler: (event: T) => void,
  options?: boolean | AddEventListenerOptions,
): () => void {
  if (!target) {
    return () => {};
  }
  target.addEventListener(type, handler as EventListener, options);
  return () => {
    target.removeEventListener(type, handler as EventListener, options);
  };
}

// Mirrors `@base-ui/utils/mergeCleanups`.
function mergeCleanups(...cleanups: Array<(() => void) | false | null | undefined>): () => void {
  return () => {
    for (const cleanup of cleanups) {
      if (typeof cleanup === "function") {
        cleanup();
      }
    }
  };
}

interface TimeoutHandle {
  start(delay: number, callback: () => void): void;
  clear(): void;
}

// Local stand-in for upstream's `useTimeout` hook.
function createTimeoutHandle(): TimeoutHandle {
  let id: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    if (id !== undefined) {
      clearTimeout(id);
      id = undefined;
    }
  };
  onCleanup(clear);
  return {
    start(delay: number, callback: () => void) {
      clear();
      id = setTimeout(callback, delay);
    },
    clear,
  };
}

interface AnimationFrameHandle {
  request(callback: () => void): void;
  cancel(): void;
}

// Local stand-in for upstream's `useAnimationFrame` hook.
function createAnimationFrameHandle(): AnimationFrameHandle {
  let id: number | undefined;
  const cancel = () => {
    if (id !== undefined) {
      cancelAnimationFrame(id);
      id = undefined;
    }
  };
  onCleanup(cancel);
  return {
    request(callback: () => void) {
      cancel();
      id = requestAnimationFrame(callback);
    },
    cancel,
  };
}

// VoiceOver's virtual cursor triggers focus only on focusable/role-button
// elements through WebKit's NSAccessibility path; the guard exposes the role
// so the trap catches the cursor. Detection is narrowed to Apple platforms.
function isVoiceOverOnWebkit() {
  if (!isWebkitEngine() || typeof navigator === "undefined") {
    return false;
  }
  const userAgent = navigator.userAgent ?? "";
  const platform = (navigator as Navigator).platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(`${platform} ${userAgent}`);
}

// Reze port of the upstream `FocusGuard` (`../../utils/FocusGuard`).
function FocusGuard(props: {
  ref?: ((element: HTMLSpanElement | null) => void) | undefined;
  onFocus: (event: FocusEvent) => void;
}): JSX.Element {
  const state = createStore({ role: undefined as "button" | undefined });

  effect(() => {
    // Unlike NVDA and JAWS, VoiceOver's virtual cursor triggers `onFocus` as
    // it moves — but only on focusable/role-button elements through WebKit's
    // NSAccessibility path. Setting `role="button"` lets the focus trap catch
    // the cursor. One-shot write: no reactive reads, runs once for the owner.
    untrack(() => {
      if (isVoiceOverOnWebkit()) {
        state.role = "button";
      }
    });
  });

  return (
    <span
      data-type="inside"
      {...{ [focusGuardAttribute]: "" }}
      ref={props.ref}
      tabindex={0}
      role={state.role}
      aria-hidden={state.role ? undefined : ("true" as const)}
      style={visuallyHidden}
      onFocus={(event) => props.onFocus(event)}
    />
  );
}

export type FloatingFocusInitialFocus =
  | boolean
  | FloatingFocusTargetRef
  | ((openType: FloatingFocusManagerInteractionType) => boolean | HTMLElement | null | void)
  | undefined;

export type FloatingFocusReturnFocus =
  | boolean
  | FloatingFocusTargetRef
  | ((closeType: FloatingFocusManagerInteractionType) => boolean | HTMLElement | null | void)
  | undefined;

export interface FloatingFocusManagerProps {
  children?: JSX.Element;
  /**
   * The floating context (root store) returned from the floating root.
   */
  context: FloatingRootStore | FloatingContext;
  /**
   * The interaction type used to open the floating element.
   */
  openInteractionType?: FloatingFocusManagerInteractionType | null | undefined;
  /**
   * Whether or not the focus manager should be disabled. Useful to delay focus
   * management until after a transition completes or some other conditional
   * state.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Determines the element to focus when the floating element is opened.
   * @default true
   */
  initialFocus?: FloatingFocusInitialFocus;
  /**
   * Determines the element to focus when the floating element is closed.
   * @default true
   */
  returnFocus?: FloatingFocusReturnFocus;
  /**
   * Whether `returnFocus` was explicitly provided. When true, focus returns to
   * the resolved element even if focus already moved elsewhere, matching the
   * behavior of a non-boolean `returnFocus` value.
   */
  explicitReturnFocus?: boolean | undefined;
  /**
   * Determines where focus should be restored if focus inside the floating
   * element is lost (such as due to the removal of the currently focused
   * element from the DOM).
   * @default false
   */
  restoreFocus?: boolean | "popup" | undefined;
  /**
   * Determines if focus is "modal", meaning focus is fully trapped inside the
   * floating element and outside content cannot be accessed.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Determines whether `focusout` event listeners that control whether the
   * floating element should be closed if the focus moves outside of it are
   * attached to the reference and floating elements.
   * @default true
   */
  closeOnFocusOut?: boolean | undefined;
  /**
   * Overrides the element to focus when tabbing forward out of the floating element.
   */
  nextFocusableElement?: FloatingFocusTargetRef | null | undefined;
  /**
   * Overrides the element to focus when tabbing backward out of the floating element.
   */
  previousFocusableElement?: FloatingFocusTargetRef | null | undefined;
  /**
   * Ref to the focus guard preceding the floating element content.
   */
  beforeContentFocusGuardRef?: ((element: HTMLSpanElement | null) => void) | { current: HTMLSpanElement | null } | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Additional elements that should be treated as part of the floating subtree
   * even if they are rendered outside the floating element itself.
   */
  getInsideElements?: (() => Array<Element | null | undefined>) | undefined;
}

/**
 * Provides focus management for the floating element.
 * @see https://floating-ui.com/docs/FloatingFocusManager
 * @internal
 */
export function FloatingFocusManager(props: FloatingFocusManagerProps): JSX.Element {
  const store =
    "rootStore" in props.context ? (props.context.rootStore as unknown as FloatingRootStore) : (props.context as FloatingRootStore);

  const open = store.useState("open");
  const domReference = store.useState("domReferenceElement");
  const floating = store.useState("floatingElement");
  const { events, dataRef } = store.context;

  const externalTree = untrack(() => props.externalTree);
  const tree = useFloatingTree(externalTree);
  const portalContext = usePortalContext();

  // Plain locals replace upstream's `useRef` cells; signals are
  // unnecessary since these are never read reactively.
  let preventReturnFocus = false;
  let isPointerDown = false;
  let pointerDownOutside = false;
  let lastFocusedTabbable: FocusableElement | null = null;
  let closeType: FloatingFocusManagerInteractionType = "";
  let lastInteractionType: FloatingFocusManagerInteractionType = "";

  let beforeGuard: HTMLSpanElement | null = null;
  let afterGuard: HTMLSpanElement | null = null;

  const blurTimeout = createTimeoutHandle();
  const pointerDownTimeout = createTimeoutHandle();
  const restoreFocusFrame = createAnimationFrameHandle();

  onCleanup(() => {
    beforeGuard = null;
    afterGuard = null;
  });

  const getNodeId = () => dataRef.current.floatingContext?.nodeId;

  const getFloatingFocusEl = () => getFloatingFocusElement(floating());

  // Listeners and microtasks run outside any tracking scope: reading the accessor there would
  // never subscribe (and warns under strict reads), so they resolve from the snapshot.
  const peekFloatingFocusEl = () => getFloatingFocusElement(store.peek("floatingElement"));

  const isUntrappedTypeableCombobox = () => isTypeableCombobox(domReference()) && props.initialFocus === false;

  const getTabbableContent = (container: Element | null = peekFloatingFocusEl()) => {
    return container ? tabbable(container) : [];
  };

  const getResolvedInsideElements = () => props.getInsideElements?.().filter((element): element is Element => element != null) ?? [];

  const setBeforeGuard = (element: HTMLSpanElement | null) => {
    beforeGuard = element;
    const external = props.beforeContentFocusGuardRef;
    if (typeof external === "function") {
      external(element);
    } else if (external) {
      external.current = element;
    }
    if (portalContext) {
      portalContext.beforeInsideRef.current = element;
    }
  };

  const setAfterGuard = (element: HTMLSpanElement | null) => {
    afterGuard = element;
    if (portalContext) {
      portalContext.afterInsideRef.current = element;
    }
  };

  const handleBeforeGuardFocus = (event: FocusEvent) => {
    if (props.modal ?? true) {
      const tabbables = getTabbableContent();
      // enqueueFocus returns a rAF-cancel function we don't need here.
      void enqueueFocus(tabbables[tabbables.length - 1] ?? null);
      return;
    }
    const portalNode = portalContext?.portalNode() ?? null;
    if (!portalNode) {
      return;
    }
    preventReturnFocus = false;
    if (isOutsideEvent(event, portalNode)) {
      const nextTabbable = getNextTabbable(store.peek("domReferenceElement"));
      nextTabbable?.focus();
    } else {
      resolveRef(props.previousFocusableElement ?? portalContext?.beforeOutsideRef ?? null)?.focus();
    }
  };

  const handleAfterGuardFocus = (event: FocusEvent) => {
    if (props.modal ?? true) {
      // enqueueFocus returns a rAF-cancel function we don't need here.
      void enqueueFocus(getTabbableContent()[0] ?? null);
      return;
    }
    const portalNode = portalContext?.portalNode() ?? null;
    if (!portalNode) {
      return;
    }
    if (props.closeOnFocusOut ?? true) {
      preventReturnFocus = true;
    }
    if (isOutsideEvent(event, portalNode)) {
      const prevTabbable = getPreviousTabbable(store.peek("domReferenceElement"));
      prevTabbable?.focus();
    } else {
      resolveRef(props.nextFocusableElement ?? portalContext?.afterOutsideRef ?? null)?.focus();
    }
  };

  // Prevent Tab from escaping the modal when there are no tabbable elements.
  effect(() => {
    const disabled = props.disabled ?? false;
    const isModal = props.modal ?? true;
    const focusEl = getFloatingFocusEl();
    const untrapped = isUntrappedTypeableCombobox();
    let cleanup: (() => void) | undefined;
    // One-shot listener wiring: the values only steer the subscription.
    untrack(() => {
      if (disabled || !isModal) {
        return;
      }

      function onKeyDown(event: KeyboardEvent) {
        if (event.key === "Tab") {
          // The focus guards have nothing to focus, so we need to stop the event.
          if (
            focusEl &&
            contains(focusEl, activeElement(ownerDocument(focusEl))) &&
            getTabbableContent(focusEl).length === 0 &&
            !untrapped
          ) {
            stopEvent(event);
          }
        }
      }

      cleanup = listen(ownerDocument(focusEl), "keydown", onKeyDown);
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  // Track pointer/keyboard interactions to disambiguate focus and outside presses.
  effect(() => {
    const disabled = props.disabled ?? false;
    const isOpen = open();
    const floatingEl = floating();
    const domReferenceEl = domReference();
    const focusEl = getFloatingFocusEl();
    const portalNode = portalContext?.portalNode() ?? null;
    let cleanup: (() => void) | undefined;
    // One-shot listener wiring: the values only steer the subscriptions.
    untrack(() => {
      if (disabled || !isOpen) {
        return;
      }

      function clearPointerDownOutside() {
        pointerDownOutside = false;
      }

      function onPointerDown(event: PointerEvent) {
        const target = getTarget(event) as Element | null;
        const insideElements = getResolvedInsideElements();
        const currentPortalNode = portalContext?.portalNode() ?? null;
        const pointerTargetInside =
          contains(floatingEl, target) ||
          contains(domReferenceEl, target) ||
          contains(currentPortalNode, target) ||
          insideElements.some((element) => element === target || contains(element, target));
        pointerDownOutside = !pointerTargetInside;
        lastInteractionType = (event.pointerType as FloatingFocusManagerInteractionType) || "keyboard";

        if (target?.closest(`[${CLICK_TRIGGER_IDENTIFIER}]`)) {
          isPointerDown = true;
          // Reset on the next tick so a single click on a click-trigger doesn't
          // permanently suppress focus-out closing for the lifetime of the instance.
          pointerDownTimeout.start(0, () => {
            isPointerDown = false;
          });
        }
      }

      function onKeyDown() {
        lastInteractionType = "keyboard";
      }

      const doc = ownerDocument(focusEl);
      cleanup = mergeCleanups(
        listen(doc, "pointerdown", onPointerDown, true),
        listen(doc, "pointerup", clearPointerDownOutside, true),
        listen(doc, "pointercancel", clearPointerDownOutside, true),
        listen(doc, "keydown", onKeyDown, true),
        // Avoid a stale `true` leaking into the next open (e.g. keep-mounted popups)
        // if the popup dismissed between pointerdown and pointerup.
        clearPointerDownOutside,
      );
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  // Close on focus out and restore focus within the floating tree when needed.
  effect(() => {
    const disabled = props.disabled ?? false;
    const closeOnFocusOut = props.closeOnFocusOut ?? true;
    const floatingEl = floating();
    const domReferenceEl = domReference();
    const focusEl = getFloatingFocusEl();
    const isModal = props.modal ?? true;
    const restoreFocus = props.restoreFocus ?? false;
    const untrapped = isUntrappedTypeableCombobox();
    let cleanup: (() => void) | undefined;
    // One-shot listener wiring: the values only steer the subscriptions.
    untrack(() => {
      if (disabled || !closeOnFocusOut) {
        return;
      }

      // In Safari, buttons lose focus when pressing them.
      function handlePointerDown() {
        isPointerDown = true;
        pointerDownTimeout.start(0, () => {
          isPointerDown = false;
        });
      }

      function handleFocusIn(event: FocusEvent) {
        const target = getTarget(event) as FocusableElement | null;
        if (isTabbable(target)) {
          lastFocusedTabbable = target;
        }
      }

      function handleFocusOutside(event: FocusEvent) {
        const relatedTarget = event.relatedTarget as HTMLElement | null;
        const currentTarget = event.currentTarget;
        const target = getTarget(event) as HTMLElement | null;
        const focusElement = peekFloatingFocusEl();

        // When focus is lost to the body (e.g. on a backdrop press), record the element that
        // had focus so a confirmation dialog opened while the body is focused can return focus
        // to it. Scoped to `modal` to avoid non-modal popups polluting the shared stack.
        if (isModal && relatedTarget == null && target != null && contains(floatingEl, target)) {
          addPreviouslyFocusedElement(target);
        }

        queueMicrotask(() => {
          const nodeId = getNodeId();
          const triggers = store.context.triggerElements;
          const insideElements = getResolvedInsideElements();
          const isRelatedFocusGuard =
            relatedTarget?.hasAttribute(focusGuardAttribute) &&
            [
              beforeGuard,
              afterGuard,
              portalContext?.beforeInsideRef.current ?? null,
              portalContext?.afterInsideRef.current ?? null,
              portalContext?.beforeOutsideRef.current ?? null,
              portalContext?.afterOutsideRef.current ?? null,
              resolveRef(props.previousFocusableElement),
              resolveRef(props.nextFocusableElement),
            ].includes(relatedTarget);

          // `TriggerElementsMap` has no `hasMatchingElement`; iterate entries instead.
          let triggerContainsRelated = false;
          for (const [, trigger] of triggers.entries()) {
            if (contains(trigger, relatedTarget)) {
              triggerContainsRelated = true;
              break;
            }
          }

          const movedToUnrelatedNode = !(
            contains(domReferenceEl, relatedTarget) ||
            contains(floatingEl, relatedTarget) ||
            contains(relatedTarget, floatingEl) ||
            contains(portalContext?.portalNode() ?? null, relatedTarget) ||
            insideElements.some((element) => element === relatedTarget || contains(element, relatedTarget)) ||
            triggerContainsRelated ||
            isRelatedFocusGuard ||
            (tree &&
              (getNodeChildren(tree.nodesRef.current, nodeId).find(
                (node) =>
                  contains(node.context?.elements.floating, relatedTarget) || contains(node.context?.elements.domReference, relatedTarget),
              ) ||
                getNodeAncestors(tree.nodesRef.current, nodeId).find(
                  (node) =>
                    [node.context?.elements.floating, getFloatingFocusElement(node.context?.elements.floating)].includes(relatedTarget) ||
                    node.context?.elements.domReference === relatedTarget,
                )))
          );

          if (currentTarget === domReferenceEl && focusElement) {
            handleTabIndex(focusElement);
          }

          // Restore focus to the previously focused tabbable element to prevent
          // focus from being lost outside the floating tree.
          if (
            restoreFocus &&
            currentTarget !== domReferenceEl &&
            !isElementVisible(target) &&
            activeElement(ownerDocument(focusElement)) === ownerDocument(focusElement).body
          ) {
            // Let `FloatingPortal` effect knows that focus is still inside the
            // floating tree.
            if (isHTMLElement(focusElement)) {
              focusElement.focus();
              // If explicitly requested to restore focus to the popup container, do not search
              // for the next/previous tabbable element.
              if (restoreFocus === "popup") {
                // If the focused element is removed on pointerdown, the browser
                // tries to move focus to it right after the `.focus()` call above,
                // but because it's removed in the same tick, focus is lost instead.
                // Re-focusing asynchronously (next frame) wins that race.
                restoreFocusFrame.request(() => {
                  focusElement.focus();
                });
                return;
              }
            }

            const tabbableContent = getTabbableContent() as Array<Element | null>;
            const prevTabbable = lastFocusedTabbable;
            const nodeToFocus =
              (prevTabbable && tabbableContent.includes(prevTabbable) ? prevTabbable : null) ||
              tabbableContent[tabbableContent.length - 1] ||
              focusElement;

            if (isHTMLElement(nodeToFocus)) {
              nodeToFocus.focus();
            }
          }

          // https://github.com/floating-ui/floating-ui/issues/3060
          if (dataRef.current.insideReactTree) {
            dataRef.current.insideReactTree = false;
            return;
          }

          // Focus did not move inside the floating tree, and there are no tabbable
          // portal guards to handle closing.
          if (
            (untrapped ? true : !isModal) &&
            relatedTarget &&
            movedToUnrelatedNode &&
            !isPointerDown &&
            // Fix for double-rendered returnFocus: for an "untrapped" typeable combobox
            // (input role=combobox with initialFocus=false), re-opening the popup and tabbing
            // out should still close it even when the previously focused element is focused
            // again. Allow closing when untrapped regardless of the previously focused element.
            (untrapped || relatedTarget !== getPreviouslyFocusedElement())
          ) {
            preventReturnFocus = true;
            store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event));
          }
        });
      }

      function markInsideReactTree() {
        if (pointerDownOutside) {
          return;
        }
        dataRef.current.insideReactTree = true;
        blurTimeout.start(0, () => {
          dataRef.current.insideReactTree = false;
        });
      }

      const domReferenceElement = isHTMLElement(domReferenceEl) ? domReferenceEl : null;
      if (!floatingEl && !domReferenceElement) {
        return;
      }

      cleanup = mergeCleanups(
        domReferenceElement && listen(domReferenceElement, "focusout", handleFocusOutside),
        domReferenceElement && listen(domReferenceElement, "pointerdown", handlePointerDown),
        floatingEl && listen(floatingEl, "focusin", handleFocusIn),
        floatingEl && listen(floatingEl, "focusout", handleFocusOutside),
        floatingEl && portalContext && listen(floatingEl, "focusout", markInsideReactTree, true),
      );
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  // Hide everything outside the floating tree from assistive tech while open.
  effect(() => {
    const isOpen = open();
    const disabled = props.disabled ?? false;
    const domReferenceEl = domReference();
    const floatingEl = floating();
    const isModal = props.modal ?? true;
    const portalNode = portalContext?.portalNode() ?? null;
    const untrapped = isUntrappedTypeableCombobox();
    let cleanup: (() => void) | undefined;
    // One-shot aria hiding: the values only steer the hiding.
    untrack(() => {
      if (disabled || !floatingEl || !isOpen) {
        return;
      }

      // Don't hide portals nested within the parent portal.
      const portalNodes = Array.from(portalNode?.querySelectorAll(`[${createAttribute("portal")}]`) || []);

      const ancestors = tree ? getNodeAncestors(tree.nodesRef.current, getNodeId()) : [];
      const rootAncestorComboboxDomReference = ancestors.find((node) => isTypeableCombobox(node.context?.elements.domReference || null))
        ?.context?.elements.domReference;

      const controlInsideElements = [
        floatingEl,
        ...portalNodes,
        beforeGuard,
        afterGuard,
        portalContext?.beforeOutsideRef.current ?? null,
        portalContext?.afterOutsideRef.current ?? null,
        ...getResolvedInsideElements(),
      ];
      const insideElements = [
        ...controlInsideElements,
        rootAncestorComboboxDomReference ?? null,
        resolveRef(props.previousFocusableElement),
        resolveRef(props.nextFocusableElement),
        untrapped ? domReferenceEl : null,
      ].filter((element): element is Element => element != null);

      const ariaHiddenCleanup = markOthers(insideElements, {
        ariaHidden: isModal || untrapped,
        mark: false,
      });

      const markerInsideElements = [floatingEl, ...portalNodes].filter((element): element is Element => element != null);
      const markerCleanup = markOthers(markerInsideElements);

      cleanup = () => {
        markerCleanup();
        ariaHiddenCleanup();
      };
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  // Focus the initial element when the floating element opens.
  effect(() => {
    const disabled = props.disabled ?? false;
    const isOpen = open();
    const focusEl = getFloatingFocusEl();
    // One-shot initial focus: the values only steer the focus.
    untrack(() => {
      if (!isOpen || disabled || !isHTMLElement(focusEl)) {
        return;
      }

      closeType = "";
      lastInteractionType = "";

      const doc = ownerDocument(focusEl);
      const previouslyFocusedElement = activeElement(doc);

      // Wait for any layout effect state setters to execute to set `tabIndex`.
      queueMicrotask(() => {
        const initialFocusValue = props.initialFocus ?? true;
        const resolvedInitialFocus =
          typeof initialFocusValue === "function" ? initialFocusValue(props.openInteractionType || "") : initialFocusValue;

        // `null` should fallback to default behavior in case of an empty ref.
        if (resolvedInitialFocus === undefined || resolvedInitialFocus === false) {
          return;
        }

        if (focusEl && contains(focusEl, previouslyFocusedElement)) {
          return;
        }

        let focusableElements: Array<FocusableElement> | null = null;
        const getDefaultFocusElement = () => {
          if (focusableElements == null) {
            focusableElements = getTabbableContent(focusEl);
          }
          return focusableElements[0] || focusEl;
        };

        let elToFocus: FocusableElement | null | undefined;
        if (resolvedInitialFocus === true || resolvedInitialFocus === null) {
          elToFocus = getDefaultFocusElement();
        } else {
          elToFocus = resolveRef(resolvedInitialFocus);
        }
        elToFocus = elToFocus || getDefaultFocusElement();

        const hadFocusInside = focusEl && contains(focusEl, activeElement(doc));

        // Screen readers re-sync focus to their cursor right after a synthesized press. A focus
        // that lands a frame later reads as a stray move and gets pulled back to the reference.
        const openEvent = dataRef.current.openEvent;
        const openedByVirtualPress = openEvent?.type === "mousedown" && isVirtualClick(openEvent as MouseEvent);

        // enqueueFocus returns a rAF-cancel function; we intentionally don't cancel this focus.
        void enqueueFocus(elToFocus, {
          sync: openedByVirtualPress,
          preventScroll: elToFocus === focusEl || isPointerOpenInteraction(props.openInteractionType),
          shouldFocus() {
            // If the floating element has closed before this runs — e.g. tabbing out of a
            // kept-mounted popup — don't pull focus back onto the initial element after it has
            // legitimately moved elsewhere.
            // `peek` reads the synchronous snapshot, which is current even
            // immediately after a store write in the same tick.
            if (!store.peek("open")) {
              return false;
            }

            if (hadFocusInside) {
              return true;
            }

            const currentActiveElement = activeElement(doc);
            const focusMovedInside =
              currentActiveElement !== elToFocus && focusEl != null && contains(focusEl, currentActiveElement);

            return !focusMovedInside;
          },
        });
      });
    });
  });

  // A return-focus queued by the effect cleanup. If the effect re-arms, the cleanup
  // was not a close, so the queued return is cancelled. Unlike React (which skips
  // the cleanup/re-run cycle when dependency *values* are unchanged), a split-effect
  // apply re-runs on every compute evaluation — e.g. `openChangeReason` flipping
  // while the projected `disabled` stays false. A same-values re-arm is a scheduler
  // artifact of the close in progress: the duplicate decision is dropped but the
  // suppression the close requested is kept for the unmount cleanup. A real re-arm
  // means the popup stayed open, so stale suppression is cleared like upstream.
  let pendingReturnFocusJob: { cancelled: boolean } | null = null;
  let lastReturnFocusState:
    | { disabled: boolean; floating: Element | null; focusEl: Element | null; domReference: Element | null }
    | undefined;
  let lastProjectionEqual = false;
  // Track return focus targets and restore focus on unmount/close.
  effect(() => {
    const next = {
      disabled: props.disabled ?? false,
      floating: floating(),
      focusEl: getFloatingFocusEl(),
      domReference: domReference(),
    };
    const last = lastReturnFocusState;
    // Projection reads subscribe this effect to the store keys; the equality
    // check itself steers only the bookkeeping below.
    const projection = untrack(() => {
      if (
        last !== undefined &&
        last.disabled === next.disabled &&
        last.floating === next.floating &&
        last.focusEl === next.focusEl &&
        last.domReference === next.domReference
      ) {
        lastProjectionEqual = true;
        return last;
      }
      lastProjectionEqual = false;
      lastReturnFocusState = next;
      return next;
    });
    const current = projection;
    let cleanup: (() => void) | undefined;
    // One-shot return-focus arming: the values only steer the arming.
    untrack(() => {
      if (current.disabled || !current.focusEl) {
        pendingReturnFocusJob = null;
        return;
      }

      if (pendingReturnFocusJob) {
        pendingReturnFocusJob.cancelled = true;
        pendingReturnFocusJob = null;
        if (!lastProjectionEqual) {
          preventReturnFocus = false;
        }
      }

      const doc = ownerDocument(current.focusEl);
      const elementFocusedBeforeOpen = activeElement(doc);
      // Only an explicit `null` interaction type represents a programmatic open.
      // `undefined` is normalized to `''` by the prop default, so it never reaches
      // here as nullish and is intentionally not treated as programmatic.
      const preferPreviousFocus = props.openInteractionType === null;

      addPreviouslyFocusedElement(elementFocusedBeforeOpen);

      function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
        if (!details.open) {
          closeType = getEventType(details.nativeEvent, lastInteractionType);
        }

        // Focus guards transfer focus themselves; other close handlers may still need return focus.
        if (
          (details.reason === REASONS.focusOut && details.triggerElement?.hasAttribute(focusGuardAttribute)) ||
          (details.reason === REASONS.triggerHover && details.nativeEvent.type === "mouseleave")
        ) {
          preventReturnFocus = true;
        }

        if (details.reason !== REASONS.outsidePress) {
          return;
        }

        if (details.nested) {
          preventReturnFocus = false;
        } else if (isVirtualClick(details.nativeEvent as MouseEvent) || isVirtualPointerEvent(details.nativeEvent as PointerEvent)) {
          preventReturnFocus = false;
        } else {
          // On outside press, only return focus to the reference when the browser supports the
          // `focus({ preventScroll })` option; without it, restoring focus scrolls the page.
          // Chrome on Android and Samsung Internet still don't support `preventScroll`, so the
          // runtime check keeps return focus disabled there to avoid the scroll jump.
          let isPreventScrollSupported = false;
          ownerDocument(current.focusEl)
            .createElement("div")
            .focus({
              get preventScroll() {
                isPreventScrollSupported = true;
                return false;
              },
            });

          if (isPreventScrollSupported) {
            preventReturnFocus = false;
          } else {
            preventReturnFocus = true;
          }
        }
      }

      events.on("openchange", onOpenChangeLocal);

      function getReturnElement(closeInteractionType: FloatingFocusManagerInteractionType) {
        const returnFocusValue = props.returnFocus ?? true;
        let resolvedReturnFocusValue = typeof returnFocusValue === "function" ? returnFocusValue(closeInteractionType) : returnFocusValue;

        // `null` should fallback to default behavior in case of an empty ref.
        if (resolvedReturnFocusValue === undefined || resolvedReturnFocusValue === false) {
          return null;
        }

        if (resolvedReturnFocusValue === null) {
          resolvedReturnFocusValue = true;
        }

        const referenceReturnElement = current.domReference?.isConnected ? (current.domReference as HTMLElement) : null;
        const previousReturnElement =
          elementFocusedBeforeOpen?.isConnected && getNodeName(elementFocusedBeforeOpen) !== "body"
            ? (elementFocusedBeforeOpen as HTMLElement)
            : null;

        let defaultReturnElement =
          preferPreviousFocus && previousReturnElement ? previousReturnElement : (referenceReturnElement ?? previousReturnElement);

        if (!defaultReturnElement) {
          defaultReturnElement = (getPreviouslyFocusedElement() as HTMLElement | undefined) ?? null;
        }

        if (typeof resolvedReturnFocusValue === "boolean") {
          return defaultReturnElement;
        }

        return resolveRef(resolvedReturnFocusValue) || defaultReturnElement || null;
      }

      cleanup = () => {
        events.off("openchange", onOpenChangeLocal);

        const activeEl = activeElement(doc);
        const insideElements = getResolvedInsideElements();
        const isFocusInsideFloatingTree =
          contains(current.floating, activeEl) ||
          insideElements.some((element) => element === activeEl || contains(element, activeEl)) ||
          (tree &&
            getNodeChildren(tree.nodesRef.current, getNodeId(), false).some((node) => contains(node.context?.elements.floating, activeEl)));

        const returnFocusValue = props.returnFocus ?? true;
        const returnElement = getReturnElement(closeType);

        const job = { cancelled: false };
        pendingReturnFocusJob = job;

        queueMicrotask(() => {
          if (pendingReturnFocusJob === job) {
            pendingReturnFocusJob = null;
          }
          // `returnElement` if it is tabbable, otherwise its first tabbable child,
          // otherwise `returnElement` itself (which may not be tabbable at all).
          const tabbableReturnElement = getFirstTabbableElement(returnElement);
          // Read in the cleanup on purpose: the latest `explicitReturnFocus` decides.
          const hasExplicitReturnFocus = untrack(() => props.explicitReturnFocus) ?? typeof returnFocusValue !== "boolean";

          if (
            !job.cancelled &&
            returnFocusValue &&
            !preventReturnFocus &&
            isHTMLElement(tabbableReturnElement) &&
            // If the focus moved somewhere else after mount, avoid returning focus
            // since it likely entered a different element which should be
            // respected: https://github.com/floating-ui/floating-ui/issues/2607
            ((!hasExplicitReturnFocus && tabbableReturnElement !== activeEl && activeEl !== doc.body
              ? isFocusInsideFloatingTree
              : true) as boolean)
          ) {
            // `focusVisible` is a Chromium-only proposal; cast keeps it without
            // widening the shared `FocusOptions` usage.
            const focusOptions = {
              preventScroll: true,
              ...(closeType === "keyboard" ? { focusVisible: true } : {}),
            } as FocusOptions & { focusVisible?: boolean };
            tabbableReturnElement.focus(focusOptions);
          }

          // A return cancelled by a same-values re-arm belongs to the close in
          // progress: its suppression is kept for the unmount cleanup. Any other
          // return clears suppression before the next close.
          if (!job.cancelled) {
            preventReturnFocus = false;
          }
        });
      };
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  // Safari may randomly scroll to the bottom of the page if an input inside a popup has focus
  // when the popup unmounts from the DOM.
  // By blurring it before the popup unmounts, we can prevent this behavior.
  effect(() => {
    const isOpen = open();
    const floatingEl = floating();
    // One-shot blur: the values only steer the blur.
    untrack(() => {
      if (!isWebkitEngine() || isOpen || !floatingEl) {
        return;
      }

      const activeEl = activeElement(ownerDocument(floatingEl));
      if (!isHTMLElement(activeEl) || !isTypeableElement(activeEl)) {
        return;
      }

      if (contains(floatingEl, activeEl)) {
        activeEl.blur();
      }
    });
  });

  // Synchronize the focus manager state (modal, closeOnFocusOut, open, etc.) to the
  // FloatingPortal context, which uses it to decide whether to render its own guards.
  effect(() => {
    const disabled = props.disabled ?? false;
    const isModal = props.modal ?? true;
    const isOpen = open();
    const closeOnFocusOut = props.closeOnFocusOut ?? true;
    const domReferenceEl = domReference();
    let cleanup: (() => void) | undefined;
    // One-shot context sync: the values only steer the sync.
    untrack(() => {
      if (disabled || !portalContext) {
        return;
      }

      portalContext.setFocusManagerState({
        modal: isModal,
        closeOnFocusOut,
        open: isOpen,
        // The portal calls with `(open, details?)` while the store requires full
        // change details; bridge the two instead of passing `store.setOpen` through.
        onOpenChange: (nextOpen: boolean, data?: { reason?: string | undefined; event?: Event | undefined }) => {
          const details = createChangeEventDetails(data?.reason ?? REASONS.none, data?.event) as RebaseUIChangeEventDetails<string>;
          store.setOpen(nextOpen, details);
        },
        domReference: domReferenceEl,
      });

      cleanup = () => {
        portalContext.setFocusManagerState(null);
      };
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  // Keep the floating element tabIndex in sync and clear stale focus records.
  effect(() => {
    const disabled = props.disabled ?? false;
    const focusEl = getFloatingFocusEl();
    let cleanup: (() => void) | undefined;
    // One-shot tabIndex sync: the values only steer the sync.
    untrack(() => {
      if (disabled || !focusEl) {
        return;
      }
      handleTabIndex(focusEl);
      cleanup = () => {
        queueMicrotask(clearDisconnectedPreviouslyFocusedElements);
      };
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  const shouldRenderGuards = () => {
    const disabled = props.disabled ?? false;
    if (disabled) {
      return false;
    }
    const isModal = props.modal ?? true;
    const isInsidePortal = portalContext != null;
    return (isModal ? !isUntrappedTypeableCombobox() : true) && (isInsidePortal || isModal);
  };

  return (
    <>
      {shouldRenderGuards() && <FocusGuard ref={setBeforeGuard} onFocus={handleBeforeGuardFocus} />}
      {props.children}
      {shouldRenderGuards() && <FocusGuard ref={setAfterGuard} onFocus={handleAfterGuardFocus} />}
    </>
  );
}
