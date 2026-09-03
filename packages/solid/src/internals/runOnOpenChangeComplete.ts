import { type Accessor, createEffect } from "solid-js";

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
   * Accessor for the element being closed.
   */
  ref: Accessor<HTMLElement | null | undefined>;
  /**
   * Function to call when the animation completes (or there is no animation).
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

  createEffect(
    () => ({ enabled: enabled(), open: open() }),
    ({ enabled: isEnabled }) => {
      if (!isEnabled) {
        return undefined;
      }

      const abortController = new AbortController();

      runOnAnimationsFinished(parameters.onComplete, abortController.signal);

      return () => {
        abortController.abort();
      };
    },
  );
}
