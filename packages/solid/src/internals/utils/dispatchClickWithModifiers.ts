export interface ClickModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export function dispatchClickWithModifiers(
  target: Element,
  sourceEvent: ClickModifiers,
  { detail = 0 }: { detail?: number | undefined } = {},
) {
  const view = target.ownerDocument?.defaultView;
  const EventConstructor = (view?.PointerEvent ?? view?.MouseEvent) as typeof MouseEvent;

  target.dispatchEvent(
    new EventConstructor("click", {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail,
      shiftKey: sourceEvent.shiftKey,
      ctrlKey: sourceEvent.ctrlKey,
      altKey: sourceEvent.altKey,
      metaKey: sourceEvent.metaKey,
    }),
  );
}
