import { effect, store, untrack } from "reze-js";

import { runOnOpenChangeComplete } from "./runOnOpenChangeComplete";
import { createTransitionStatus, type TransitionStatus } from "./transition-status/createTransitionStatus";

export interface CreateUnmountAfterCloseParameters {
  /**
   * Whether the popup is open.
   */
  open: () => boolean;
  /**
   * Accessor for the element whose closing animations are awaited before unmounting.
   */
  ref: () => HTMLElement | null | undefined;
  /**
   * Whether the current close cycle asked to keep the popup mounted until the `unmount`
   * action is called. Ignored while `open`.
   */
  preventUnmountOnClose: () => boolean;
  /**
   * Writes `preventUnmountOnClose`. Opening starts a new close cycle, so the helper clears
   * it whenever `open` becomes `true`.
   */
  setPreventUnmountOnClose: (value: boolean) => void;
  /**
   * Runs once per unmount, whether it completed automatically or through `forceUnmount`.
   * Invoked untracked.
   */
  onUnmount: () => void;
}

export interface UnmountAfterClose {
  /**
   * Whether the popup is mounted.
   */
  mounted: () => boolean;
  /**
   * The transition status of the popup.
   */
  transitionStatus: () => TransitionStatus;
  /**
   * Unmounts the popup immediately. It is a no-op once the popup is already unmounted,
   * so calling it after the automatic unmount doesn't repeat the completion callback.
   */
  forceUnmount: () => void;
}

/**
 * Keeps a popup mounted through its closing animation and unmounts it once the animation
 * finishes, unless the close cycle opted out through `preventUnmountOnClose`.
 * Store-agnostic: hosts sync `mounted` and `transitionStatus` wherever they need them.
 */
export function createUnmountAfterClose(parameters: CreateUnmountAfterCloseParameters): UnmountAfterClose {
  const state = store({
    mounted: untrack(parameters.open),
    transitionStatus: undefined as TransitionStatus,
  });

  function mounted(): boolean {
    return state.mounted;
  }

  function setMounted(next: boolean): void {
    untrack(() => {
      if (state.mounted !== next) {
        state.mounted = next;
      }
    });
  }

  function transitionStatus(): TransitionStatus {
    return state.transitionStatus;
  }

  function setTransitionStatus(next: TransitionStatus): void {
    untrack(() => {
      if (state.transitionStatus !== next) {
        state.transitionStatus = next;
      }
    });
  }

  createTransitionStatus({ open: parameters.open, mounted, transitionStatus, setMounted, setTransitionStatus });

  // Opening starts a new close cycle, so the opt-out must not leak into the next close.
  effect(() => {
    const isOpen = parameters.open();
    if (isOpen) {
      untrack(() => {
        parameters.setPreventUnmountOnClose(false);
      });
    }
  });

  function forceUnmount() {
    // Repeated `unmount()` calls in one batch read the updated value and
    // complete closing exactly once.
    if (!untrack(mounted)) {
      return;
    }

    if (!untrack(parameters.open)) {
      // Upstream re-mounts an open popup during the same render pass, so no observer ever
      // sees the transient unmount (in particular, focus is never returned). Skipping the
      // write while open reproduces that atomicity; the completion still runs once.
      setMounted(false);
    }
    // One-shot host cleanup: never subscribe, whether this runs from an event
    // handler or from the untracked completion continuation below.
    untrack(parameters.onUnmount);
  }

  runOnOpenChangeComplete({
    enabled: () => mounted() && !parameters.open() && !parameters.preventUnmountOnClose(),
    open: parameters.open,
    ref: parameters.ref,
    onComplete() {
      // The synchronous completion path runs inside the effect, so read one-shot.
      if (!untrack(parameters.open)) {
        forceUnmount();
      }
    },
  });

  return { mounted, transitionStatus, forceUnmount };
}
