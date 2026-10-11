export interface ClickModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/**
 * Dispatches a synthetic click on `target`, copying the source event's
 * modifier state, which `click()` always reports as unpressed. Like `click()`,
 * the untrusted click still runs native activation behavior (form submission,
 * link navigation).
 * `detail` defaults to 0 and `pointerType` to `''` (the native convention for
 * keyboard-generated clicks). When the click represents a mouse gesture, pass
 * `detail: 1` and `pointerType: 'mouse'` so consumers don't classify it as a
 * keyboard activation.
 */
export function dispatchClickWithModifiers(
  target: Element,
  sourceEvent: ClickModifiers,
  { detail = 0, pointerType = "" }: { detail?: number | undefined; pointerType?: string | undefined } = {},
) {
  const view = target.ownerDocument?.defaultView;
  const EventConstructor = (view?.PointerEvent ?? view?.MouseEvent) as typeof MouseEvent;

  target.dispatchEvent(
    new EventConstructor("click", {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail,
      pointerType,
      shiftKey: sourceEvent.shiftKey,
      ctrlKey: sourceEvent.ctrlKey,
      altKey: sourceEvent.altKey,
      metaKey: sourceEvent.metaKey,
    } as MouseEventInit),
  );
}
