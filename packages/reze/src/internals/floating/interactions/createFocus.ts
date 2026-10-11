import { isElement, isHTMLElement } from "@floating-ui/utils/dom";
import { effect, onCleanup, untrack } from "reze-js";

import { createChangeEventDetails } from "../../event-details/createEventDetails";
import { REASONS } from "../../event-details/reasons";
import type { FloatingContext, FloatingUIOpenChangeDetails } from "../types";
import { createAttribute } from "../utils/createAttribute";
import { activeElement, contains, getTarget, isTargetInsideEnabledTrigger, isTypeableElement, matchesFocusVisible } from "../utils/element";

function isMacSafari() {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent ?? "";
  return /mac/i.test(navigator.platform ?? "") && /applewebkit/i.test(ua) && !/chrome/i.test(ua);
}

function ownerDocument(node: Element | null | undefined): Document {
  return node?.ownerDocument ?? document;
}

function addListener(target: EventTarget, type: string, listener: (event: any) => void, options?: AddEventListenerOptions | boolean) {
  target.addEventListener(type, listener, options);
  return () => {
    target.removeEventListener(type, listener, options);
  };
}

export interface CreateFocusProps {
  /** Whether the interaction is enabled. Read once; not reactive. @default true */
  enabled?: boolean | undefined;
  /** Delay (ms) before opening; function form is evaluated per focus event. Read once. @default undefined */
  delay?: number | (() => number | undefined) | undefined;
}

export interface FocusReferenceProps {
  onMouseLeave: (event: MouseEvent) => void;
  onFocus: (event: FocusEvent) => void;
  onBlur: (event: FocusEvent) => void;
}

export interface CreateFocusResult {
  /** Getter returning props to spread onto the reference element. */
  reference: () => FocusReferenceProps;
  /** Alias of `reference` for trigger-style composition (mirrors upstream). */
  trigger: () => FocusReferenceProps;
}

/**
 * Opens the floating element while the reference element has focus, like CSS
 * `:focus`. Reze port of upstream `useFocus` (mui/base-ui v1.8.0).
 * Handlers receive native DOM events; consumers spread `reference()` (or
 * `trigger()`) onto an element.
 */
export function createFocus(context: FloatingContext, props: CreateFocusProps = {}): CreateFocusResult {
  const store = context.rootStore;
  const { events, dataRef } = store.context;

  const enabled = untrack(() => props.enabled ?? true);
  const delay = untrack(() => props.delay);

  let blockFocus = false;
  // Track which reference should be blocked from re-opening after
  // Escape/press dismissal.
  let blockedReference: Element | null = null;
  let keyboardModality = true;

  let delayTimer: ReturnType<typeof setTimeout> | undefined;
  let blurTimer: ReturnType<typeof setTimeout> | undefined;

  // Clear pending timers when the interaction owner disposes.
  effect(() => {
    onCleanup(() => {
      clearTimeout(delayTimer);
      clearTimeout(blurTimer);
    });
  });

  effect(() => {
    const domReference = store.select("domReferenceElement");
    let cleanup: (() => void) | undefined;
    // One-shot listener wiring: the element only steers the subscriptions.
    untrack(() => {
      if (!enabled) {
        return;
      }

      const win = ownerDocument(domReference).defaultView ?? window;

      // If the reference was focused and the user left the tab/window, and the
      // floating element was not open, focus is blocked when they return.
      function onBlur() {
        const currentDomReference = store.peek("domReferenceElement");
        if (
          !store.peek("open") &&
          isHTMLElement(currentDomReference) &&
          currentDomReference === activeElement(ownerDocument(currentDomReference))
        ) {
          blockFocus = true;
          blockedReference = currentDomReference;
        }
      }

      function onKeyDown() {
        keyboardModality = true;
      }

      function onPointerDown() {
        keyboardModality = false;
      }

      const cleanups = [
        addListener(win, "blur", onBlur),
        ...(isMacSafari() ? [addListener(win, "keydown", onKeyDown, true)] : []),
        ...(isMacSafari() ? [addListener(win, "pointerdown", onPointerDown, true)] : []),
      ];

      cleanup = () => {
        cleanups.forEach((cleanupListener) => cleanupListener());
      };
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  effect(() => {
    let cleanup: (() => void) | undefined;
    // One-shot subscription: no reactive reads, runs once for the owner.
    untrack(() => {
      if (!enabled) {
        return;
      }

      function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
        if (details.reason === REASONS.triggerPress || details.reason === REASONS.escapeKey) {
          const referenceElement = store.peek("domReferenceElement");
          if (isElement(referenceElement)) {
            blockedReference = referenceElement;
            blockFocus = true;
          }
        }
      }

      events.on("openchange", onOpenChangeLocal);
      cleanup = () => {
        events.off("openchange", onOpenChangeLocal);
      };
    });
    if (cleanup) {
      onCleanup(cleanup);
    }
  });

  function resetBlockedFocus() {
    blockFocus = false;
    blockedReference = null;
  }

  const referenceProps: FocusReferenceProps = {
    onMouseLeave() {
      resetBlockedFocus();
    },
    onFocus(event) {
      const focusTarget = event.currentTarget as Element | null;

      if (blockFocus) {
        if (blockedReference === focusTarget) {
          return;
        }

        resetBlockedFocus();
      }

      const target = getTarget(event);

      if (isElement(target)) {
        // Safari fails to match `:focus-visible` if focus was initially
        // outside the document.
        if (isMacSafari() && !event.relatedTarget) {
          if (!keyboardModality && !isTypeableElement(target)) {
            return;
          }
        } else if (!matchesFocusVisible(target as Element)) {
          return;
        }
      }

      const movedFromOtherEnabledTrigger = isTargetInsideEnabledTrigger(event.relatedTarget, store.context.triggerElements);

      const delayValue = typeof delay === "function" ? delay() : delay;

      if ((store.peek("open") && movedFromOtherEnabledTrigger) || delayValue === 0 || delayValue === undefined) {
        store.setOpen(true, createChangeEventDetails(REASONS.triggerFocus, event, focusTarget as HTMLElement));
        return;
      }

      clearTimeout(delayTimer);
      delayTimer = setTimeout(() => {
        if (blockFocus) {
          return;
        }

        store.setOpen(true, createChangeEventDetails(REASONS.triggerFocus, event, focusTarget as HTMLElement));
      }, delayValue);
    },
    onBlur(event) {
      resetBlockedFocus();

      const relatedTarget = event.relatedTarget;
      const nativeEvent = event;

      // Hit the non-modal focus management portal guard. Focus will be
      // moved into the floating element immediately after.
      const movedToFocusGuard =
        isElement(relatedTarget) &&
        (relatedTarget as Element).hasAttribute(createAttribute("focus-guard")) &&
        (relatedTarget as Element).getAttribute("data-type") === "outside";

      // Wait for the window blur listener to fire.
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        const domReference = store.peek("domReferenceElement");
        const activeEl = activeElement(ownerDocument(domReference));

        // Focus left the page, keep it open.
        if (!relatedTarget && activeEl === domReference) {
          return;
        }

        // When focusing the reference element (e.g. regular click), then
        // clicking into the floating element, prevent it from hiding. The
        // floating element must be focusable, e.g. `tabindex="-1"`. The
        // relatedTarget can't be trusted inside shadow roots (it only points
        // to the shadow host), so the active element is checked instead.
        if (
          contains(dataRef.current.floatingContext?.refs.floating.current, activeEl as Element) ||
          contains(domReference, activeEl as Element) ||
          movedToFocusGuard
        ) {
          return;
        }

        // If the next focused element is one of the triggers, do not close;
        // that trigger's focus handler owns the open state.
        const nextFocusedElement = (relatedTarget ?? activeEl) as EventTarget | null;
        if (isTargetInsideEnabledTrigger(nextFocusedElement, store.context.triggerElements)) {
          return;
        }

        store.setOpen(false, createChangeEventDetails(REASONS.triggerFocus, nativeEvent));
      }, 0);
    },
  };

  const reference = () => (enabled ? referenceProps : ({} as FocusReferenceProps));
  const trigger = () => (enabled ? referenceProps : ({} as FocusReferenceProps));

  return { reference, trigger };
}
