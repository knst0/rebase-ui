import { type Accessor, onCleanup, untrack } from "solid-js";

import { TransitionStatusDataAttributes } from "./transition-status";

export type AnimationsFinishedRunner = (fnToExecute: () => void, signal?: AbortSignal | null) => void;

/**
 * Executes a function once all animations have finished on the provided element.
 * If an animation is canceled, waits for any replacement animations before executing.
 * Only one pending run is kept at a time: a new call cancels the previous one.
 * @param element - accessor for the element to watch for animations.
 * @param waitForStartingStyleRemoved - accessor for whether to wait for `[data-starting-style]`
 * to be removed before checking for animations.
 */
export function createAnimationsFinishedRunner(
  element: Accessor<HTMLElement | null | undefined>,
  waitForStartingStyleRemoved: () => boolean = () => false,
): AnimationsFinishedRunner {
  let cancelPending: (() => void) | undefined;

  const cancel = () => {
    cancelPending?.();
    cancelPending = undefined;
  };

  onCleanup(cancel);

  // Whether the element animates in the current `open` epoch. Probed on the first run of
  // each epoch and cached: repeat runs skip `getAnimations` entirely until `open` changes.
  let cachedElement: HTMLElement | null | undefined;
  let cachedOpen: boolean | undefined;
  let cachedHasAnimations: boolean | undefined;

  return (fnToExecute, signal = null) => {
    cancel();

    const resolvedElement = untrack(element);
    if (resolvedElement == null) {
      return;
    }

    if (globalThis.REBASE_UI_ANIMATIONS_DISABLED || typeof resolvedElement.getAnimations !== "function") {
      fnToExecute();
      return;
    }

    const open = untrack(waitForStartingStyleRemoved);
    if (cachedElement !== resolvedElement || cachedOpen !== open) {
      cachedElement = resolvedElement;
      cachedOpen = open;
      cachedHasAnimations = undefined;
    } else if (cachedHasAnimations === false && !signal?.aborted) {
      // Probed before in this epoch: the element doesn't animate, so there is nothing to wait for.
      fnToExecute();
      return;
    }

    const scheduleExec = () => {
      const frame = requestAnimationFrame(() => {
        cancelPending = undefined;
        exec();
      });
      cancelPending = () => cancelAnimationFrame(frame);
    };

    const exec = () => {
      if (signal?.aborted) {
        return;
      }

      const animations = resolvedElement.getAnimations();
      if (animations.length === 0) {
        // Early exit: the element isn't animating, so there is nothing to wait for.
        // Cache the outcome until `open` changes instead of re-querying on every run.
        cachedHasAnimations = false;
        fnToExecute();
        return;
      }
      cachedHasAnimations = true;

      Promise.all(animations.map((animation) => animation.finished)).then(
        () => {
          if (!signal?.aborted) {
            fnToExecute();
          }
        },
        () => {
          if (signal?.aborted) {
            return;
          }

          const currentAnimations = resolvedElement.getAnimations();

          if (currentAnimations.some((animation) => animation.pending || animation.playState !== "finished")) {
            exec();
            return;
          }

          fnToExecute();
        },
      );
    };

    if (untrack(waitForStartingStyleRemoved)) {
      if (!resolvedElement.hasAttribute(TransitionStatusDataAttributes.startingStyle)) {
        scheduleExec();
        return;
      }

      const observer = new MutationObserver(() => {
        if (!resolvedElement.hasAttribute(TransitionStatusDataAttributes.startingStyle)) {
          cancel();
          exec();
        }
      });

      observer.observe(resolvedElement, {
        attributes: true,
        attributeFilter: [TransitionStatusDataAttributes.startingStyle],
      });

      const abortHandler = () => cancel();
      signal?.addEventListener("abort", abortHandler, { once: true });

      cancelPending = () => {
        observer.disconnect();
        signal?.removeEventListener("abort", abortHandler);
      };
      return;
    }

    scheduleExec();
  };
}
