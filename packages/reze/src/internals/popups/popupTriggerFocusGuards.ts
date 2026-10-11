import { createChangeEventDetails, REASONS } from "../event-details";
import { getTabbableNearElement, isOutsideEvent } from "../floating/utils/tabbable";

/**
 * Minimal store interface required by the trigger focus guards.
 * Both PopoverStore and MenuStore satisfy this interface.
 */
export interface TriggerFocusGuardStore {
  setOpen(open: boolean, eventDetails: any): void;
  peek(key: "positionerElement"): HTMLElement | null;
  context: {
    /**
     * Shared with the focus manager through `getInsideElements` so that blurring the trigger
     * onto this guard does not close the popup before the guard's own focus handler runs.
     */
    readonly beforeTriggerFocusGuardRef: { current: HTMLElement | null };
    readonly beforeContentFocusGuardRef: { current: HTMLElement | null };
    readonly triggerFocusTargetRef: { current: HTMLElement | null };
  };
}

export interface TriggerFocusGuards {
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
  function closeAndFocus(event: FocusEvent, direction: 1 | -1, positionerElement: HTMLElement | null) {
    const guard = event.currentTarget as HTMLElement;

    // The store commit is synchronous; the tab order below resolves after it.
    store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event, guard));

    // The close callback may change the tab order. Resolve it after the flush, using
    // the trigger as the anchor if the guard unmounted, even when its tabIndex is -1.
    getTabbableNearElement(guard.isConnected ? guard : triggerElementRef.current, direction, positionerElement)?.focus();
  }

  function handlePreFocusGuardFocus(event: FocusEvent) {
    closeAndFocus(event, -1, store.peek("positionerElement"));
  }

  function handleFocusTargetFocus(event: FocusEvent) {
    const positionerElement = store.peek("positionerElement");
    if (positionerElement && isOutsideEvent(event, positionerElement)) {
      store.context.beforeContentFocusGuardRef.current?.focus();
    } else {
      closeAndFocus(event, 1, positionerElement);
    }
  }

  return { handlePreFocusGuardFocus, handleFocusTargetFocus };
}
