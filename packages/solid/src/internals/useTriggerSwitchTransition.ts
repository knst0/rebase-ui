import { createEffect } from "solid-js";

import { createAnimationsFinishedRunner } from "./createAnimationsFinishedRunner";

/**
 * Popover and Menu declare different `instantType` unions, so only the members
 * this hook touches are typed.
 */
export interface TriggerSwitchTransitionStore {
  /**
   * Read raw, because the `instantType` selector deliberately hides
   * `trigger-change` while closed — which is exactly when it has to be cleared.
   */
  peekState(): { readonly instantType: string | undefined };
  peek(key: "open"): boolean;
  set(key: "instantType", value: "trigger-change" | undefined): void;
}

export interface UseTriggerSwitchTransitionParameters {
  store: TriggerSwitchTransitionStore;
  /**
   * The trigger element that currently owns the popup.
   */
  domReference: () => Element | null;
  positionerElement: () => HTMLElement | null;
  open: () => boolean;
}

/**
 * Lets the positioner animate while a popup moves between detached triggers.
 *
 * The positioner is normally marked instant, so a hand-off from one trigger to
 * another would teleport. Clearing `instantType` for the duration of the move
 * lets it transition, and `trigger-change` is restored once the move finishes.
 *
 * The restoration is deferred until the move's animations finish, so it can
 * outlive the move that scheduled it. The trigger element is retained through
 * the exit transition, so a close alone does not change `domReference` and
 * nothing would otherwise re-run this effect to abort it — a popup that closes
 * and reopens on the same trigger mid-exit would inherit the stale callback and
 * lose its own transition. Closing therefore cancels the pending restoration
 * explicitly.
 *
 * Applying `trigger-change` to a closed popup is prevented separately, by the
 * stores' `instantType` selector, since a controlled `open={false}` commit
 * reaches the popup without passing through `setOpen`.
 */
export function useTriggerSwitchTransition(parameters: UseTriggerSwitchTransitionParameters): void {
  const { store, domReference, positionerElement, open } = parameters;

  let previousTrigger: Element | null = null;
  let pendingSwitch: AbortController | null = null;
  const runOnceAnimationsFinish = createAnimationsFinishedRunner(positionerElement);

  createEffect(
    () => open(),
    (isOpen) => {
      if (isOpen) {
        return undefined;
      }

      pendingSwitch?.abort();
      pendingSwitch = null;

      // `trigger-change` belongs to the open cycle that scheduled it. The selector
      // stops a closed popup from rendering it, but the value has to be dropped
      // too: a controlled reopen changes only `openProp`, so neither this effect
      // nor `setOpen` would run again to replace it, and the selector would start
      // exposing the old value against the new cycle.
      if (store.peekState().instantType === "trigger-change") {
        store.set("instantType", undefined);
      }
      return undefined;
    },
  );

  createEffect(
    () => domReference(),
    (currentTrigger) => {
      const previous = previousTrigger;

      if (currentTrigger) {
        previousTrigger = currentTrigger;
      }

      if (!previous || !currentTrigger || currentTrigger === previous) {
        return undefined;
      }

      // The trigger element can also change while the popup is closing, when a
      // trigger is replaced by a new element. There is no move to animate, and
      // the cancellation effect above has already run for this commit, so a
      // restoration scheduled here would survive into whatever opens next.
      if (!store.peek("open")) {
        return undefined;
      }

      store.set("instantType", undefined);

      const abortController = new AbortController();
      pendingSwitch = abortController;

      runOnceAnimationsFinish(() => {
        // The abort above covers a committed close, but the animations can finish
        // in the same frame the close commits. Writing `trigger-change` then would
        // leave stale state behind for the next open to inherit.
        if (store.peek("open")) {
          store.set("instantType", "trigger-change");
        }
      }, abortController.signal);

      return () => {
        abortController.abort();
      };
    },
  );
}
