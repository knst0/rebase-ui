import { getNodeName, isHTMLElement } from "@floating-ui/utils/dom";
import { type JSX } from "@solidjs/web";
import { createEffect, createSignal, onCleanup, untrack } from "solid-js";

import { type RebaseUIChangeEventDetails } from "../../event-details/createEventDetails";
import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import { ownerDocument, ownerWindow } from "../../utils/owner";
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

// Approximation of `platform.engine.webkit` (`@base-ui/utils/platform`):
// a WebKit engine that is not Chromium-based.
function isWebkitEngine() {
  if (typeof navigator === "undefined") {
    return false;
  }
  const userAgent = navigator.userAgent ?? "";
  return /applewebkit/i.test(userAgent) && !/chrome|crios|chromium|edg/i.test(userAgent);
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

// Solid port of the upstream `FocusGuard` (`../../utils/FocusGuard`).
function FocusGuard(props: {
  ref?: ((element: HTMLSpanElement | null) => void) | undefined;
  onFocus: (event: FocusEvent) => void;
}): JSX.Element {
  const [role, setRole] = createSignal<"button" | undefined>(undefined);

  createEffect(
    () => true,
    () => {
      // Unlike NVDA and JAWS, VoiceOver's virtual cursor triggers `onFocus` as
      // it moves — but only on focusable/role-button elements through WebKit's
      // NSAccessibility path. Setting `role="button"` lets the focus trap catch
      // the cursor.
      if (isVoiceOverOnWebkit()) {
        setRole("button");
      }
    },
  );

  return (
    <span
      data-type="inside"
      {...{ [focusGuardAttribute]: "" }}
      ref={props.ref}
      tabindex={0}
      role={role()}
      aria-hidden={role() ? undefined : ("true" as const)}
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

  // Plain locals replace upstream's `useRef` cells; Solid signals are
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

  const isUntrappedTypeableCombobox = () => isTypeableCombobox(domReference()) && props.initialFocus === false;

  const getTabbableContent = (container: Element | null = getFloatingFocusEl()) => {
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
      const nextTabbable = getNextTabbable(store.select("domReferenceElement"));
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
      const prevTabbable = getPreviousTabbable(store.select("domReferenceElement"));
      prevTabbable?.focus();
    } else {
      resolveRef(props.nextFocusableElement ?? portalContext?.afterOutsideRef ?? null)?.focus();
    }
  };

  // Prevent Tab from escaping the modal when there are no tabbable elements.
  createEffect(
    () => ({
      disabled: props.disabled ?? false,
      modal: props.modal ?? true,
      focusEl: getFloatingFocusEl(),
      untrapped: isUntrappedTypeableCombobox(),
    }),
    (state) => {
      if (state.disabled || !state.modal) {
        return undefined;
      }

      function onKeyDown(event: KeyboardEvent) {
        if (event.key === "Tab") {
          // The focus guards have nothing to focus, so we need to stop the event.
          if (
            state.focusEl &&
            contains(state.focusEl, activeElement(ownerDocument(state.focusEl))) &&
            getTabbableContent(state.focusEl).length === 0 &&
            !state.untrapped
          ) {
            stopEvent(event);
          }
        }
      }

      return listen(ownerDocument(state.focusEl), "keydown", onKeyDown);
    },
  );

  // Track pointer/keyboard interactions to disambiguate focus and outside presses.
  createEffect(
    () => ({
      disabled: props.disabled ?? false,
      isOpen: open(),
      floating: floating(),
      domReference: domReference(),
      focusEl: getFloatingFocusEl(),
      portalNode: portalContext?.portalNode() ?? null,
    }),
    (state) => {
      if (state.disabled || !state.isOpen) {
        return undefined;
      }

      function clearPointerDownOutside() {
        pointerDownOutside = false;
      }

      function onPointerDown(event: PointerEvent) {
        const target = getTarget(event) as Element | null;
        const insideElements = getResolvedInsideElements();
        const portalNode = portalContext?.portalNode() ?? null;
        const pointerTargetInside =
          contains(state.floating, target) ||
          contains(state.domReference, target) ||
          contains(portalNode, target) ||
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

      const doc = ownerDocument(state.focusEl);
      return mergeCleanups(
        listen(doc, "pointerdown", onPointerDown, true),
        listen(doc, "pointerup", clearPointerDownOutside, true),
        listen(doc, "pointercancel", clearPointerDownOutside, true),
        listen(doc, "keydown", onKeyDown, true),
        // Avoid a stale `true` leaking into the next open (e.g. keep-mounted popups)
        // if the popup dismissed between pointerdown and pointerup.
        clearPointerDownOutside,
      );
    },
  );

  // Close on focus out and restore focus within the floating tree when needed.
  createEffect(
    () => ({
      disabled: props.disabled ?? false,
      closeOnFocusOut: props.closeOnFocusOut ?? true,
      floating: floating(),
      domReference: domReference(),
      focusEl: getFloatingFocusEl(),
      modal: props.modal ?? true,
      restoreFocus: props.restoreFocus ?? false,
      untrapped: isUntrappedTypeableCombobox(),
    }),
    (state) => {
      if (state.disabled || !state.closeOnFocusOut) {
        return undefined;
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
        const focusEl = getFloatingFocusEl();

        // When focus is lost to the body (e.g. on a backdrop press), record the element that
        // had focus so a confirmation dialog opened while the body is focused can return focus
        // to it. Scoped to `modal` to avoid non-modal popups polluting the shared stack.
        if (state.modal && relatedTarget == null && target != null && contains(state.floating, target)) {
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
            contains(state.domReference, relatedTarget) ||
            contains(state.floating, relatedTarget) ||
            contains(relatedTarget, state.floating) ||
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

          if (currentTarget === state.domReference && focusEl) {
            handleTabIndex(focusEl);
          }

          // Restore focus to the previously focused tabbable element to prevent
          // focus from being lost outside the floating tree.
          if (
            state.restoreFocus &&
            currentTarget !== state.domReference &&
            !isElementVisible(target) &&
            activeElement(ownerDocument(focusEl)) === ownerDocument(focusEl).body
          ) {
            // Let `FloatingPortal` effect knows that focus is still inside the
            // floating tree.
            if (isHTMLElement(focusEl)) {
              focusEl.focus();
              // If explicitly requested to restore focus to the popup container, do not search
              // for the next/previous tabbable element.
              if (state.restoreFocus === "popup") {
                // If the focused element is removed on pointerdown, the browser
                // tries to move focus to it right after the `.focus()` call above,
                // but because it's removed in the same tick, focus is lost instead.
                // Re-focusing asynchronously (next frame) wins that race.
                restoreFocusFrame.request(() => {
                  focusEl.focus();
                });
                return;
              }
            }

            const tabbableContent = getTabbableContent() as Array<Element | null>;
            const prevTabbable = lastFocusedTabbable;
            const nodeToFocus =
              (prevTabbable && tabbableContent.includes(prevTabbable) ? prevTabbable : null) ||
              tabbableContent[tabbableContent.length - 1] ||
              focusEl;

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
            (state.untrapped ? true : !state.modal) &&
            relatedTarget &&
            movedToUnrelatedNode &&
            !isPointerDown &&
            // Fix for double-rendered returnFocus: for an "untrapped" typeable combobox
            // (input role=combobox with initialFocus=false), re-opening the popup and tabbing
            // out should still close it even when the previously focused element is focused
            // again. Allow closing when untrapped regardless of the previously focused element.
            (state.untrapped || relatedTarget !== getPreviouslyFocusedElement())
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

      const domReferenceElement = isHTMLElement(state.domReference) ? state.domReference : null;
      if (!state.floating && !domReferenceElement) {
        return undefined;
      }

      return mergeCleanups(
        domReferenceElement && listen(domReferenceElement, "focusout", handleFocusOutside),
        domReferenceElement && listen(domReferenceElement, "pointerdown", handlePointerDown),
        state.floating && listen(state.floating, "focusin", handleFocusIn),
        state.floating && listen(state.floating, "focusout", handleFocusOutside),
        state.floating && portalContext && listen(state.floating, "focusout", markInsideReactTree, true),
      );
    },
  );

  // Hide everything outside the floating tree from assistive tech while open.
  createEffect(
    () => ({
      isOpen: open(),
      disabled: props.disabled ?? false,
      domReference: domReference(),
      floating: floating(),
      modal: props.modal ?? true,
      portalNode: portalContext?.portalNode() ?? null,
      untrapped: isUntrappedTypeableCombobox(),
    }),
    (state) => {
      if (state.disabled || !state.floating || !state.isOpen) {
        return undefined;
      }

      // Don't hide portals nested within the parent portal.
      const portalNodes = Array.from(state.portalNode?.querySelectorAll(`[${createAttribute("portal")}]`) || []);

      const ancestors = tree ? getNodeAncestors(tree.nodesRef.current, getNodeId()) : [];
      const rootAncestorComboboxDomReference = ancestors.find((node) => isTypeableCombobox(node.context?.elements.domReference || null))
        ?.context?.elements.domReference;

      const controlInsideElements = [
        state.floating,
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
        state.untrapped ? state.domReference : null,
      ].filter((element): element is Element => element != null);

      const ariaHiddenCleanup = markOthers(insideElements, {
        ariaHidden: state.modal || state.untrapped,
        mark: false,
      });

      const markerInsideElements = [state.floating, ...portalNodes].filter((element): element is Element => element != null);
      const markerCleanup = markOthers(markerInsideElements);

      return () => {
        markerCleanup();
        ariaHiddenCleanup();
      };
    },
  );

  // Focus the initial element when the floating element opens.
  createEffect(
    () => ({
      disabled: props.disabled ?? false,
      isOpen: open(),
      focusEl: getFloatingFocusEl(),
    }),
    (state) => {
      if (!state.isOpen || state.disabled || !isHTMLElement(state.focusEl)) {
        return;
      }

      closeType = "";
      lastInteractionType = "";

      const doc = ownerDocument(state.focusEl);
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

        if (state.focusEl && contains(state.focusEl, previouslyFocusedElement)) {
          return;
        }

        let focusableElements: Array<FocusableElement> | null = null;
        const getDefaultFocusElement = () => {
          if (focusableElements == null) {
            focusableElements = getTabbableContent(state.focusEl);
          }
          return focusableElements[0] || state.focusEl;
        };

        let elToFocus: FocusableElement | null | undefined;
        if (resolvedInitialFocus === true || resolvedInitialFocus === null) {
          elToFocus = getDefaultFocusElement();
        } else {
          elToFocus = resolveRef(resolvedInitialFocus);
        }
        elToFocus = elToFocus || getDefaultFocusElement();

        const hadFocusInside = state.focusEl && contains(state.focusEl, activeElement(doc));

        // enqueueFocus returns a rAF-cancel function; we intentionally don't cancel this focus.
        void enqueueFocus(elToFocus, {
          preventScroll: elToFocus === state.focusEl || isPointerOpenInteraction(props.openInteractionType),
          shouldFocus() {
            // This focus is queued on the next animation frame. If the floating element has closed
            // before it runs — e.g. tabbing out of a kept-mounted popup — don't pull focus back
            // onto the initial element after it has legitimately moved elsewhere.
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
              currentActiveElement !== elToFocus && state.focusEl != null && contains(state.focusEl, currentActiveElement);

            return !focusMovedInside;
          },
        });
      });
    },
  );

  // Track return focus targets and restore focus on unmount/close.
  createEffect(
    () => ({
      disabled: props.disabled ?? false,
      floating: floating(),
      focusEl: getFloatingFocusEl(),
      domReference: domReference(),
    }),
    (state) => {
      if (state.disabled || !state.focusEl) {
        return undefined;
      }

      const doc = ownerDocument(state.focusEl);
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

        if (details.reason === REASONS.triggerHover && details.nativeEvent.type === "mouseleave") {
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
          ownerDocument(state.focusEl)
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

        const referenceReturnElement = state.domReference?.isConnected ? (state.domReference as HTMLElement) : null;
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

      return () => {
        events.off("openchange", onOpenChangeLocal);

        const activeEl = activeElement(doc);
        const insideElements = getResolvedInsideElements();
        const isFocusInsideFloatingTree =
          contains(state.floating, activeEl) ||
          insideElements.some((element) => element === activeEl || contains(element, activeEl)) ||
          (tree &&
            getNodeChildren(tree.nodesRef.current, getNodeId(), false).some((node) => contains(node.context?.elements.floating, activeEl)));

        const returnFocusValue = props.returnFocus ?? true;
        const returnElement = getReturnElement(closeType);

        queueMicrotask(() => {
          // `returnElement` if it is tabbable, otherwise its first tabbable child,
          // otherwise `returnElement` itself (which may not be tabbable at all).
          const tabbableReturnElement = getFirstTabbableElement(returnElement);
          const hasExplicitReturnFocus = typeof returnFocusValue !== "boolean";

          if (
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

          preventReturnFocus = false;
        });
      };
    },
  );

  // Safari may randomly scroll to the bottom of the page if an input inside a popup has focus
  // when the popup unmounts from the DOM.
  // By blurring it before the popup unmounts, we can prevent this behavior.
  createEffect(
    () => ({ isOpen: open(), floating: floating() }),
    (state) => {
      if (!isWebkitEngine() || state.isOpen || !state.floating) {
        return;
      }

      const activeEl = activeElement(ownerDocument(state.floating));
      if (!isHTMLElement(activeEl) || !isTypeableElement(activeEl)) {
        return;
      }

      if (contains(state.floating, activeEl)) {
        activeEl.blur();
      }
    },
  );

  // Synchronize the focus manager state (modal, closeOnFocusOut, open, etc.) to the
  // FloatingPortal context, which uses it to decide whether to render its own guards.
  createEffect(
    () => ({
      disabled: props.disabled ?? false,
      modal: props.modal ?? true,
      isOpen: open(),
      closeOnFocusOut: props.closeOnFocusOut ?? true,
      domReference: domReference(),
    }),
    (state) => {
      if (state.disabled || !portalContext) {
        return undefined;
      }

      portalContext.setFocusManagerState({
        modal: state.modal,
        closeOnFocusOut: state.closeOnFocusOut,
        open: state.isOpen,
        // The portal calls with `(open, details?)` while the store requires full
        // change details; bridge the two instead of passing `store.setOpen` through.
        onOpenChange: (nextOpen: boolean, data?: { reason?: string | undefined; event?: Event | undefined }) => {
          const details = createChangeEventDetails(data?.reason ?? REASONS.none, data?.event) as RebaseUIChangeEventDetails<string>;
          store.setOpen(nextOpen, details);
        },
        domReference: state.domReference,
      });

      return () => {
        portalContext.setFocusManagerState(null);
      };
    },
  );

  // Keep the floating element tabIndex in sync and clear stale focus records.
  createEffect(
    () => ({ disabled: props.disabled ?? false, focusEl: getFloatingFocusEl() }),
    (state) => {
      if (state.disabled || !state.focusEl) {
        return undefined;
      }
      handleTabIndex(state.focusEl);
      return () => {
        queueMicrotask(clearDisconnectedPreviouslyFocusedElements);
      };
    },
  );

  const shouldRenderGuards = () => {
    const disabled = props.disabled ?? false;
    if (disabled) {
      return false;
    }
    const modal = props.modal ?? true;
    const isInsidePortal = portalContext != null;
    return (modal ? !isUntrappedTypeableCombobox() : true) && (isInsidePortal || modal);
  };

  return (
    <>
      {shouldRenderGuards() && <FocusGuard ref={setBeforeGuard} onFocus={handleBeforeGuardFocus} />}
      {props.children}
      {shouldRenderGuards() && <FocusGuard ref={setAfterGuard} onFocus={handleAfterGuardFocus} />}
    </>
  );
}
