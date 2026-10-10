let refocusingOwner = false;

/**
 * Moves focus to the filter input without scrolling, flagging the move so the input's focus
 * handler knows it came from the list rather than the user.
 */
export function refocusOwner(owner: HTMLElement | null) {
  if (owner == null) {
    return;
  }
  refocusingOwner = true;
  owner.focus({ preventScroll: true });
  // The focus event fires synchronously; clear on the microtask so re-entrant focus handlers
  // within the same tick still observe the flag.
  queueMicrotask(() => {
    refocusingOwner = false;
  });
}

export function isRefocusingOwner() {
  return refocusingOwner;
}
