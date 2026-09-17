import type { JSX, ValidComponent } from "@solidjs/web";
import { createEffect, onCleanup, untrack } from "solid-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, createGenericEventDetails, REASONS } from "../../internals/event-details";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { CHANGE_VALUE_TICK_DELAY, START_AUTO_CHANGE_DELAY } from "../utils/constants";
import { parseNumber } from "../utils/parse";
import { stateAttributesMapping } from "../utils/stateAttributesMapping";
import type { DirectionalChangeReason, EventWithOptionalKeyState } from "../utils/types";
import type { NumberFieldRootState } from "./NumberFieldRoot";
import { useNumberFieldRootContext } from "./NumberFieldRootContext";

const SELECT_NONE_STYLE = {
  "-webkit-user-select": "none",
  "user-select": "none",
} as const;

type StepperButtonProps<T extends ValidComponent = "button"> = NativeButtonProps & RebaseUIComponentProps<T, NumberFieldRootState>;

function isTouchLikePointerType(pointerType: string | undefined): boolean {
  return pointerType === "touch" || pointerType === "pen";
}

/**
 * Shared implementation for the increment and decrement stepper buttons. They differ only in the
 * direction they step and the boundary (`max` vs `min`) at which they become disabled.
 */
export function useNumberFieldStepperButton<T extends ValidComponent>(
  componentProps: StepperButtonProps<T>,
  isIncrement: boolean,
): JSX.Element {
  const [local, elementProps] = split(componentProps as StepperButtonProps, { default: stepperDefaultProps }, [
    "as",
    "disabled",
    "nativeButton",
  ]);

  const as = untrack(() => local.as);
  const nativeButton = untrack(() => local.nativeButton);

  const store = useNumberFieldRootContext();
  const { state } = store;

  const readOnly = () => state.readOnly();
  const isAtBoundary = () => {
    const current = store.value();
    return current != null && (isIncrement ? current >= store.maxWithDefault() : current <= store.minWithDefault());
  };
  // Read-only steppers are exposed as unavailable through button disabled semantics, while
  // `data-readonly` (from `state`) is preserved for styling. `aria-readonly` isn't valid on the
  // `button` role, so it's intentionally not set.
  const buttonDisabled = () => local.disabled === true || state.disabled() === true || isAtBoundary();

  const pressReason: DirectionalChangeReason = isIncrement ? REASONS.incrementPress : REASONS.decrementPress;
  const direction = isIncrement ? 1 : -1;

  function commitValue(nativeEvent: Event) {
    const shouldCommitInputValue = !store.allowInputSyncRef.current;
    store.allowInputSyncRef.current = true;

    if (!shouldCommitInputValue) {
      // The input is already synced, so step from the authoritative numeric value rather than
      // re-parsing the rounded display text. Refresh the commit ref to the current value so a
      // subsequent canceled step can't commit a stale `lastChangedValueRef` left over from an
      // earlier change (the `setValue` that used to refresh it is now skipped on this path).
      store.lastChangedValueRef.current = untrack(store.value);
      return;
    }

    // The input is dirty but not yet blurred, so the value won't have been committed.
    const parsedValue = parseNumber(untrack(store.inputValue), untrack(store.locale), untrack(store.format));

    if (parsedValue !== null) {
      // Sync the dirty typed value with no direction so it isn't directionally snapped
      // (`snapOnStep`) before the real increment/decrement runs, which would otherwise emit a
      // spurious intermediate value.
      const details = createChangeEventDetails(pressReason, nativeEvent as never);
      store.setValue(parsedValue, details);

      // Only sync the ref base when the commit wasn't canceled, so a subsequent increment in the
      // same interaction steps from the value actually applied.
      if (!details.isCanceled) {
        store.valueRef.current = parsedValue;
      }
    }
  }

  let holding = false;
  let holdTicked = false;
  // Armed when a hold is canceled by disabling mid-press, so the trailing click of the canceled
  // press doesn't step (mirrors the upstream press-and-hold reset on `disabled`).
  let holdCanceled = false;
  let startTimeout: ReturnType<typeof setTimeout> | undefined;
  let repeatInterval: ReturnType<typeof setInterval> | undefined;

  function clearHoldTimers() {
    if (startTimeout !== undefined) {
      clearTimeout(startTimeout);
      startTimeout = undefined;
    }
    if (repeatInterval !== undefined) {
      clearInterval(repeatInterval);
      repeatInterval = undefined;
    }
  }

  function tick(triggerEvent: Event): boolean {
    // The hold may have been disabled after the timers were scheduled but before they ran;
    // stop instead of stepping from a stale press.
    if (untrack(buttonDisabled) || untrack(readOnly)) {
      clearHoldTimers();
      return false;
    }
    const amount = store.getStepAmount(triggerEvent as EventWithOptionalKeyState);
    const changed = store.incrementValue(amount, {
      direction,
      event: triggerEvent,
      reason: pressReason,
    });
    if (!changed) {
      // At a boundary (or after a canceled change) there is nothing more to repeat, so stop the
      // auto-change sequence like upstream instead of ticking forever.
      clearHoldTimers();
    }
    return changed;
  }

  function stopHold(nativeEvent: PointerEvent) {
    if (!holding) {
      return;
    }
    holding = false;
    clearHoldTimers();
    // `stopHold` fires on every release; fall back to the current value when no tick changed it.
    // Step interactions never commit `null`, so the `??` can't mask a legitimate null commit.
    const committed = store.lastChangedValueRef.current ?? store.valueRef.current;
    store.onValueCommitted(committed, createGenericEventDetails(pressReason, nativeEvent));
  }

  // Mirror the upstream press-and-hold effect: disabling (or making read-only) mid-hold cancels
  // the press — repeats stop at once instead of continuing from a stale press. The boundary is
  // deliberately excluded here: reaching it stops the timers via `tick`, but the release still
  // commits like upstream.
  createEffect(
    () => local.disabled === true || state.disabled() === true || state.readOnly() === true,
    (isDisabled) => {
      if (isDisabled) {
        if (holding || holdTicked) {
          holdCanceled = true;
        }
        holding = false;
        clearHoldTimers();
      }
    },
  );

  onCleanup(clearHoldTimers);

  const { getButtonProps, buttonRef } = createButton({
    // Read-only steppers are exposed as unavailable through button disabled semantics.
    disabled: () => buttonDisabled() || readOnly(),
    native: () => nativeButton,
    focusableWhenDisabled: true,
  });

  const buttonState: NumberFieldRootState = { ...state, disabled: buttonDisabled };

  const buttonProps = {
    get disabled() {
      return buttonDisabled();
    },
    "aria-label": isIncrement ? "Increase" : "Decrease",
    get "aria-controls"() {
      return store.id();
    },
    // Keyboard users shouldn't have access to the buttons, since they can use the input element
    // to change the value. On the other hand, `aria-hidden` is not applied because touch screen
    // readers should be able to use the buttons.
    tabindex: -1,
    style: SELECT_NONE_STYLE,
  };

  const stepperHandlers = (externalProps: Record<string, any>) => {
    const target: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "onClick" || key === "onPointerDown" || key === "onPointerUp" || key === "onPointerCancel") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    chainHandler("onClick", (event: MouseEvent) => {
      const isDisabled = untrack(buttonDisabled) || untrack(readOnly);
      if (event.defaultPrevented || isDisabled) {
        return;
      }

      // A press-and-hold already stepped (and committed on release); don't step again. A hold
      // canceled by disabling mid-press suppresses its trailing click the same way.
      if (holdTicked || holdCanceled) {
        holdTicked = false;
        holdCanceled = false;
        return;
      }

      commitValue(event);

      const amount = store.getStepAmount(event);

      const prev = store.valueRef.current;

      store.incrementValue(amount, {
        direction,
        event,
        reason: pressReason,
      });

      const committed = store.lastChangedValueRef.current ?? store.valueRef.current;
      if (committed !== prev) {
        store.onValueCommitted(committed, createGenericEventDetails(pressReason, event));
      }
    });

    chainHandler("onPointerDown", (event: PointerEvent) => {
      if (event.defaultPrevented || untrack(readOnly) || event.button || untrack(buttonDisabled)) {
        return;
      }

      // Sync dirty input value before starting the hold sequence.
      commitValue(event);
      // Treat `lastChangedValueRef` as a per-hold result slot. If the first tick is a no-op or is
      // canceled, the release commit should fall back to the current value, not a previous interaction.
      store.lastChangedValueRef.current = null;

      if (!isTouchLikePointerType(event.pointerType)) {
        // Focus the input so the user can continue with keyboard interactions.
        store.focusInput();
      }

      try {
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      } catch {
        // Ignore errors (e.g. in test environments).
      }

      holding = true;
      holdTicked = false;
      holdCanceled = false;

      startTimeout = setTimeout(() => {
        startTimeout = undefined;
        if (!tick(event)) {
          // The first tick didn't change anything (disabled, read-only, boundary, or canceled),
          // so there is nothing to repeat.
          return;
        }
        holdTicked = true;
        repeatInterval = setInterval(() => {
          if (tick(event)) {
            holdTicked = true;
          }
        }, CHANGE_VALUE_TICK_DELAY);
      }, START_AUTO_CHANGE_DELAY);
    });

    const handleRelease = (event: PointerEvent) => {
      stopHold(event);
    };

    chainHandler("onPointerUp", handleRelease);
    chainHandler("onPointerCancel", handleRelease);

    function chainHandler(key: string, internal: (event: any) => void) {
      const external = externalProps[key] as ((event: any) => void) | undefined;
      target[key] = (event: Event) => {
        external?.(event);
        if (event.defaultPrevented) {
          return;
        }
        internal(event);
      };
    }

    return target;
  };

  return (
    <RenderElement
      as={as}
      state={buttonState}
      props={[buttonProps, elementProps, stepperHandlers, getButtonProps, { ref: buttonRef }]}
      stateAttributesMapping={stateAttributesMapping}
    />
  );
}

const stepperDefaultProps = Object.freeze({
  as: "button",
  disabled: false,
  nativeButton: true,
} satisfies Partial<StepperButtonProps>);
