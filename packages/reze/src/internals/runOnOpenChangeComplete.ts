import { effect, onCleanup } from "reze-js";

import { createAnimationsFinishedRunner } from "./createAnimationsFinishedRunner";

export interface RunOnOpenChangeCompleteParameters {
  /**
   * Whether the primitive is enabled.
   * @default true
   */
  enabled?: (() => boolean) | undefined;
  /**
   * Whether the element is open.
   */
  open?: (() => boolean | undefined) | undefined;
  /**
   * Provides the element being closed.
   */
  ref: () => HTMLElement | null | undefined;
  /**
   * Function to call when the animation completes (or there is no animation).
   * Invoked imperatively, so its reads are snapshots and never subscribe.
   */
  onComplete: () => void;
}

/**
 * Calls the provided function when the CSS open/close animation or transition completes.
 */
export function runOnOpenChangeComplete(parameters: RunOnOpenChangeCompleteParameters): void {
  const enabled = () => parameters.enabled?.() ?? true;
  const open = () => parameters.open?.() ?? false;

  const runOnAnimationsFinished = createAnimationsFinishedRunner(parameters.ref, open);

  effect(() => {
    const isEnabled = enabled();
    open();

    if (!isEnabled) {
      return;
    }

    const abortController = new AbortController();

    runOnAnimationsFinished(() => parameters.onComplete(), abortController.signal);

    onCleanup(() => {
      abortController.abort();
    });
  });
}
