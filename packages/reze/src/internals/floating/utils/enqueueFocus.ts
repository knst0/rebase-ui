import type { FocusableElement } from "./tabbable";

// Local copy of `internals/utils/empty`'s `NOOP` (not yet ported to Reze).
const NOOP = () => {};

interface Options {
  preventScroll?: boolean | undefined;
  sync?: boolean | undefined;
  // Called when the frame runs to decide whether focus should still be applied.
  shouldFocus?: (() => boolean) | undefined;
}

let rafId = 0;
export function enqueueFocus(el: FocusableElement | null, options: Options = {}) {
  const { preventScroll = false, sync = false, shouldFocus } = options;

  cancelAnimationFrame(rafId);

  function exec() {
    if (shouldFocus && !shouldFocus()) {
      return;
    }
    el?.focus({ preventScroll });
  }

  if (sync) {
    exec();
    return NOOP;
  }

  const currentRafId = requestAnimationFrame(exec);
  rafId = currentRafId;
  return () => {
    if (rafId === currentRafId) {
      cancelAnimationFrame(currentRafId);
      rafId = 0;
    }
  };
}
