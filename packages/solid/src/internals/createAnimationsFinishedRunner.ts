import { type Accessor, onCleanup, untrack } from "solid-js";

import { TransitionStatusDataAttributes } from "./transition-status";

export type AnimationsFinishedRunner = (fnToExecute: () => void, signal?: AbortSignal | null) => void;

/**
 * Executes a function once all animations have finished on the provided element.
 * If an animation is canceled, waits for any replacement animations before executing.
 * @param element - accessor for the element to watch for animations.
 * @param waitForStartingStyleRemoved - accessor for whether to wait for `[data-starting-style]`
 * to be removed before checking for animations.
 */
export function createAnimationsFinishedRunner(
  element: Accessor<HTMLElement | null | undefined>,
  waitForStartingStyleRemoved: () => boolean = () => false,
): AnimationsFinishedRunner {
  let frame: number | undefined;
  let observer: MutationObserver | undefined;

  const cancelFrame = () => {
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      frame = undefined;
    }
  };

  const disconnect = () => {
    observer?.disconnect();
    observer = undefined;
  };

  onCleanup(() => {
    cancelFrame();
    disconnect();
  });

  return (fnToExecute, signal = null) => {
    cancelFrame();
    disconnect();

    const resolvedElement = untrack(element);
    if (resolvedElement == null) {
      return;
    }

    if (globalThis.REBASE_UI_ANIMATIONS_DISABLED || typeof resolvedElement.getAnimations !== "function") {
      fnToExecute();
      return;
    }

    const exec = () => {
      Promise.all(resolvedElement.getAnimations().map((animation) => animation.finished)).then(
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
        frame = requestAnimationFrame(() => {
          frame = undefined;
          exec();
        });
        return;
      }

      observer = new MutationObserver(() => {
        if (!resolvedElement.hasAttribute(TransitionStatusDataAttributes.startingStyle)) {
          disconnect();
          exec();
        }
      });

      observer.observe(resolvedElement, {
        attributes: true,
        attributeFilter: [TransitionStatusDataAttributes.startingStyle],
      });

      signal?.addEventListener("abort", disconnect, { once: true });
      return;
    }

    frame = requestAnimationFrame(() => {
      frame = undefined;
      exec();
    });
  };
}
