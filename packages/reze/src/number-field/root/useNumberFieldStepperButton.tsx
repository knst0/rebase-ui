import { parseNumber } from "@rebase-ui/core/parse";
import { dynamicElement, effect, omitProps, onCleanup, untrack, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, createGenericEventDetails, REASONS } from "../../internals/event-details";
import { mergeStyleValue, resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { CHANGE_VALUE_TICK_DELAY, START_AUTO_CHANGE_DELAY } from "../utils/constants";
import type { DirectionalChangeReason, EventWithOptionalKeyState } from "../utils/types";
import { getNumberFieldStateSnapshot, type NumberFieldRootState, type NumberFieldRootStateSelectors } from "./NumberFieldRoot";
import { useNumberFieldRootContext } from "./NumberFieldRootContext";

const SELECT_NONE_STYLE = {
  "-webkit-user-select": "none",
  "user-select": "none",
} as const;

type StepperButtonProps<T extends JSX.ElementType = "button"> = NativeButtonProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, NumberFieldRootState>;

function isTouchLikePointerType(pointerType: string | undefined): boolean {
  return pointerType === "touch" || pointerType === "pen";
}

/**
 * Shared implementation for the increment and decrement stepper buttons. They differ only in the
 * direction they step and the boundary (`max` vs `min`) at which they become disabled.
 */
export function useNumberFieldStepperButton<T extends JSX.ElementType>(componentProps: StepperButtonProps<T>, isIncrement: boolean): JSX.Element {
  const rest = omitProps(
    componentProps,
    "as",
    "disabled",
    "nativeButton",
    "onClick",
    "onMouseDown",
    "onKeyDown",
    "onKeyUp",
    "onPointerDown",
    "onPointerUp",
    "onPointerCancel",
    "aria-label",
    "aria-controls",
    "tabindex",
    "tabIndex",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = componentProps.children;

  const store = useNumberFieldRootContext();
  const { state } = store;

  function readOnly(): boolean {
    return state.readOnly();
  }

  function isAtBoundary(): boolean {
    const current = store.value();
    return current != null && (isIncrement ? current >= store.maxWithDefault() : current <= store.minWithDefault());
  }

  // Read-only steppers are exposed as unavailable through button disabled semantics, while
  // `data-readonly` (from `state`) is preserved for styling. `aria-readonly` isn't valid on the
  // `button` role, so it's intentionally not set.
  function buttonDisabled(): boolean {
    return componentProps.disabled === true || state.disabled() === true || isAtBoundary();
  }

  const buttonState: NumberFieldRootStateSelectors = { ...state, disabled: buttonDisabled };

  function snapshot(): NumberFieldRootState {
    return getNumberFieldStateSnapshot(buttonState);
  }

  const pressReason: DirectionalChangeReason = isIncrement ? REASONS.incrementPress : REASONS.decrementPress;
  const direction = isIncrement ? 1 : -1;

  function commitValue(nativeEvent: Event): void {
    const shouldCommitInputValue = !store.allowInputSyncRef.current;
    store.allowInputSyncRef.current = true;

    if (!shouldCommitInputValue) {
      // The input is already synced, so step from the authoritative numeric value rather than
      // re-parsing the rounded display text. Refresh the commit ref to the current value so a
      // subsequent canceled step can't commit a stale `lastChangedValueRef` left over from an
      // earlier change (the `setValue` that used to refresh it is now skipped on this path).
      store.lastChangedValueRef.current = store.value();
      return;
    }

    // The input is dirty but not yet blurred, so the value won't have been committed.
    const parsedValue = parseNumber(store.inputValue(), store.locale(), store.format());

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

  function clearHoldTimers(): void {
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
    if (buttonDisabled() || readOnly()) {
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

  function stopHold(nativeEvent: PointerEvent): void {
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
  effect(() => {
    const isDisabled = componentProps.disabled === true || state.disabled() === true || state.readOnly() === true;

    untrack(() => {
      if (isDisabled) {
        if (holding || holdTicked) {
          holdCanceled = true;
        }
        holding = false;
        clearHoldTimers();
      }
    });
  });

  onCleanup(clearHoldTimers);

  function handleClick(event: MouseEvent): void {
    (componentProps.onClick as unknown as ((event: MouseEvent) => void) | undefined)?.(event);
    if (event.defaultPrevented) {
      return;
    }

    const isDisabled = buttonDisabled() || readOnly();
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
  }

  function handlePointerDown(event: PointerEvent): void {
    (componentProps.onPointerDown as unknown as ((event: PointerEvent) => void) | undefined)?.(event);
    if (event.defaultPrevented) {
      return;
    }

    if (event.defaultPrevented || readOnly() || event.button || buttonDisabled()) {
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
  }

  function handleRelease(event: PointerEvent): void {
    stopHold(event);
  }

  function handlePointerUp(event: PointerEvent): void {
    (componentProps.onPointerUp as unknown as ((event: PointerEvent) => void) | undefined)?.(event);
    if (event.defaultPrevented) {
      return;
    }
    handleRelease(event);
  }

  function handlePointerCancel(event: PointerEvent): void {
    (componentProps.onPointerCancel as unknown as ((event: PointerEvent) => void) | undefined)?.(event);
    if (event.defaultPrevented) {
      return;
    }
    handleRelease(event);
  }

  const button = createButton({
    get disabled() {
      return buttonDisabled() || readOnly();
    },
    get nativeButton() {
      return componentProps.nativeButton;
    },
    focusableWhenDisabled: true,
    get ref() {
      return componentProps.ref;
    },
    get onClick() {
      return handleClick;
    },
    get onMouseDown() {
      return componentProps.onMouseDown;
    },
    get onKeyDown() {
      return componentProps.onKeyDown;
    },
    get onKeyUp() {
      return componentProps.onKeyUp;
    },
    get onPointerDown() {
      return handlePointerDown;
    },
  });

  const Tag = dynamicElement<JSX.ElementType>(() => componentProps.as ?? "button");

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      type={button.type}
      role={button.role}
      bool:disabled={buttonDisabled()}
      tabindex={button.tabIndex}
      aria-disabled={button.ariaDisabled}
      aria-label={componentProps["aria-label"] ?? (isIncrement ? "Increase" : "Decrease")}
      aria-controls={componentProps["aria-controls"] ?? store.id()}
      style={mergeStyleValue(SELECT_NONE_STYLE, resolveStyleValue(componentProps.style, snapshot()))}
      data-disabled={buttonDisabled() ? "" : undefined}
      data-readonly={state.readOnly() ? "" : undefined}
      data-required={state.required() ? "" : undefined}
      data-scrubbing={state.scrubbing() ? "" : undefined}
      data-valid={state.valid() === true ? "" : undefined}
      data-invalid={state.valid() === false ? "" : undefined}
      data-touched={state.touched() ? "" : undefined}
      data-dirty={state.dirty() ? "" : undefined}
      data-filled={state.filled() ? "" : undefined}
      data-focused={state.focused() ? "" : undefined}
      data-validating={state.validating() ? "" : undefined}
      class={resolveClassValue(componentProps.class, snapshot())}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      ref={button.buttonRef}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}
