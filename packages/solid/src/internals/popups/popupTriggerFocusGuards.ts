import { flush } from "solid-js";

import { createChangeEventDetails, REASONS } from "../event-details";
import { contains } from "../floating/utils/element";
import { getNextTabbable, getTabbableAfterElement, getTabbableBeforeElement, isOutsideEvent } from "../floating/utils/tabbable";

/**
 * Minimal store interface required by the trigger focus guards.
 * Both PopoverStore and MenuStore satisfy this interface.
 */
export interface TriggerFocusGuardStore {
  setOpen(open: boolean, eventDetails: any): void;
  peek(key: "positionerElement"): HTMLElement | null;
  context: {
    readonly beforeContentFocusGuardRef: { current: HTMLElement | null };
    readonly triggerFocusTargetRef: { current: HTMLElement | null };
  };
}

export interface TriggerFocusGuards {
  preFocusGuardRef: { current: HTMLElement | null };
  handlePreFocusGuardFocus: (event: FocusEvent) => void;
  handleFocusTargetFocus: (event: FocusEvent) => void;
}

/**
 * Provides focus guard handlers for popup triggers (Popover, Menu).
 *
 * When the popup is open, invisible focus guard elements are placed before and after
 * the trigger. These handlers close the popup and move focus to the appropriate
 * tabbable element when the guards receive focus (i.e. when the user tabs out).
 * Solid port of upstream `useTriggerFocusGuards` (mui/base-ui `utils/popups`).
 */
export function createTriggerFocusGuards(
  store: TriggerFocusGuardStore,
  triggerElementRef: { readonly current: Element | null },
): TriggerFocusGuards {
  const preFocusGuardRef: { current: HTMLElement | null } = { current: null };

  function handlePreFocusGuardFocus(event: FocusEvent) {
    store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event, (event.currentTarget as HTMLElement) ?? undefined));
    flush();

    const previousTabbable = getTabbableBeforeElement(preFocusGuardRef.current);
    previousTabbable?.focus();
  }

  function handleFocusTargetFocus(event: FocusEvent) {
    const positionerElement = store.peek("positionerElement");
    if (positionerElement && isOutsideEvent(event, positionerElement)) {
      store.context.beforeContentFocusGuardRef.current?.focus();
      return;
    }

    store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event, (event.currentTarget as HTMLElement) ?? undefined));
    flush();

    let nextTabbable = getTabbableAfterElement(store.context.triggerFocusTargetRef.current ?? triggerElementRef.current);

    while (nextTabbable !== null && contains(positionerElement, nextTabbable)) {
      const prevTabbable = nextTabbable;
      nextTabbable = getNextTabbable(nextTabbable);
      if (nextTabbable === prevTabbable) {
        break;
      }
    }

    nextTabbable?.focus();
  }

  return { preFocusGuardRef, handlePreFocusGuardFocus, handleFocusTargetFocus };
}
