import { createEffect } from "solid-js";

let lockCount = 0;
let savedOverflow: string | null = null;
let savedPaddingRight: string | null = null;

function getScrollbarWidth(): number {
  if (typeof document === "undefined") {
    return 0;
  }

  return window.innerWidth - document.documentElement.clientWidth;
}

function lock(): void {
  if (lockCount === 0) {
    const bodyStyle = document.body.style;
    savedOverflow = bodyStyle.overflow;
    savedPaddingRight = bodyStyle.paddingRight;
    bodyStyle.overflow = "hidden";

    const scrollbarWidth = getScrollbarWidth();
    if (scrollbarWidth > 0) {
      const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      bodyStyle.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
  }

  lockCount += 1;
}

function unlock(): void {
  if (lockCount === 0) {
    return;
  }

  lockCount -= 1;

  if (lockCount === 0 && savedOverflow !== null && savedPaddingRight !== null) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
    savedOverflow = null;
    savedPaddingRight = null;
  }
}

export interface CreateScrollLockParameters {
  /**
   * Whether the scroll lock is active.
   */
  enabled: () => boolean;
}

/**
 * Locks document body scroll while enabled. Nested locks are reference
 * counted so an inner dialog closing does not unlock an outer one early.
 */
export function createScrollLock(parameters: CreateScrollLockParameters): void {
  createEffect(
    () => parameters.enabled(),
    (enabled) => {
      if (!enabled) {
        return undefined;
      }

      lock();

      return () => {
        unlock();
      };
    },
  );
}
