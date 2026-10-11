export function contains(parent: Element | null | undefined, child: Element | null | undefined): boolean {
  return parent != null && child != null && parent.contains(child);
}

export function getEventTarget(event: Event): EventTarget | null {
  return event.composedPath?.()[0] ?? event.target;
}
