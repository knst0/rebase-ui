import { isElement, isHTMLElement, isShadowRoot } from "@floating-ui/utils/dom";

import type { TriggerElementsMap } from "../types";
import { FOCUSABLE_ATTRIBUTE, TYPEABLE_SELECTOR } from "./constants";

// Mirrors `TooltipTriggerDataAttributes.triggerDisabled`, inlined so this
// module does not depend on the tooltip component group.
const TRIGGER_DISABLED_ATTRIBUTE = "data-trigger-disabled";

function isJSDOM() {
  return typeof navigator !== "undefined" && /jsdom|happydom/.test((navigator.userAgent ?? "").toLowerCase());
}

// Framework-free ports of `@base-ui/utils/shadowDom`, re-exported here as upstream.
export function activeElement(doc: Document) {
  let element = doc.activeElement;

  while (element?.shadowRoot?.activeElement != null) {
    element = element.shadowRoot.activeElement;
  }

  return element;
}

export function contains(parent?: Element | null, child?: Element | null) {
  if (!parent || !child) {
    return false;
  }

  const rootNode = child.getRootNode?.();

  // First, attempt with the faster native method.
  if (parent.contains(child)) {
    return true;
  }

  // Then fall back to traversing out of shadow roots when needed.
  if (rootNode && isShadowRoot(rootNode)) {
    let next = child;
    while (next) {
      if (parent === next) {
        return true;
      }
      next = (next.parentNode as Element) || (next as unknown as ShadowRoot).host;
    }
  }

  return false;
}

export function getTarget(event: Event) {
  if ("composedPath" in event) {
    // The composed path is empty once the event is no longer being dispatched,
    // so fall back to `target` for handlers running after dispatch completes.
    return event.composedPath()[0] ?? event.target;
  }

  // TS assumes `composedPath()` always exists, but older browsers without
  // shadow DOM support still fall back to `target`.
  return (event as Event).target;
}

export function isTargetInsideEnabledTrigger(target: EventTarget | null, triggerElements: TriggerElementsMap) {
  if (!isElement(target)) {
    return false;
  }

  const targetElement = target as Element;

  if (triggerElements.hasElement(targetElement)) {
    return !targetElement.hasAttribute(TRIGGER_DISABLED_ATTRIBUTE);
  }

  for (const [, trigger] of triggerElements.entries()) {
    if (contains(trigger, targetElement)) {
      return !trigger.hasAttribute(TRIGGER_DISABLED_ATTRIBUTE);
    }
  }

  return false;
}

export function isEventTargetWithin(event: Event, node: Node | null | undefined) {
  if (node == null) {
    return false;
  }

  if ("composedPath" in event) {
    return event.composedPath().includes(node);
  }

  // TS thinks `event` is of type never as it assumes all browsers support composedPath, but browsers without shadow dom don't
  const eventAgain = event as Event;
  return eventAgain.target != null && node.contains(eventAgain.target as Node);
}

export function isRootElement(element: Element): boolean {
  return element.matches("html,body");
}

export function isTypeableElement(element: unknown): boolean {
  return isHTMLElement(element) && element.matches(TYPEABLE_SELECTOR);
}

export function isInteractiveElement(element: Element | null) {
  return element?.closest(`button,a[href],[role="button"],select,[tabindex]:not([tabindex="-1"]),${TYPEABLE_SELECTOR}`) != null;
}

export function isTypeableCombobox(element: Element | null) {
  if (!element) {
    return false;
  }
  return element.getAttribute("role") === "combobox" && isTypeableElement(element);
}

export function matchesFocusVisible(element: Element | null) {
  // We don't want to block focus from working with `visibleOnly`
  // (JSDOM doesn't match `:focus-visible` when the element has `:focus`)
  if (!element || isJSDOM()) {
    return true;
  }
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

export function getFloatingFocusElement(floatingElement: HTMLElement | null | undefined): HTMLElement | null {
  if (!floatingElement) {
    return null;
  }
  // Try to find the element that has `{...getFloatingProps()}` spread on it.
  // This indicates the floating element is acting as a positioning wrapper, and
  // so focus should be managed on the child element with the event handlers and
  // aria props.
  return floatingElement.hasAttribute(FOCUSABLE_ATTRIBUTE)
    ? floatingElement
    : floatingElement.querySelector(`[${FOCUSABLE_ATTRIBUTE}]`) || floatingElement;
}
