interface PopupLabelProps {
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
}

export function resolvePopupLabel(props: PopupLabelProps, activeTriggerElement: Element | null, activeTriggerId: string | null) {
  const ariaLabel = props["aria-label"];
  let ariaLabelledBy = props["aria-labelledby"];

  if (ariaLabelledBy == null && !ariaLabel) {
    // Prefer the element's live id: an explicitly rendered id wins over the registered one.
    ariaLabelledBy = activeTriggerElement?.id || activeTriggerId || undefined;
  }

  return ariaLabelledBy;
}
