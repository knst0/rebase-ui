import { formatNumber } from "@rebase-ui/core/formatNumber";
import {
  BASE_NON_NUMERIC_SYMBOLS,
  getFormatParts,
  getNumberLocaleDetails,
  MINUS_SIGNS_WITH_ASCII,
  PERCENTAGES,
  PERMILLE,
  PLUS_SIGNS_WITH_ASCII,
  SPACE_SEPARATOR_RE,
} from "@rebase-ui/core/parse";
import { toValidatedNumber } from "@rebase-ui/core/validate";
import { dynamicElement, effect, getOwner, omitProps, onCleanup, runWithOwner, store, untrack, type JSX } from "reze-js";

import type { FieldRootState } from "../../field/root/FieldRoot";
import { createControllableSignal } from "../../internals/createControllableSignal";
import {
  createChangeEventDetails,
  createGenericEventDetails,
  REASONS,
  type RebaseUIChangeEventDetails,
  type RebaseUIGenericEventDetails,
} from "../../internals/event-details";
import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { FieldRootContext, useFieldRootContext } from "../../internals/field-root-context";
import { FormContext, useFormContext } from "../../internals/form-context";
import { createLabelableId, LabelableContext, useLabelableContext } from "../../internals/labelable-provider";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { visuallyHidden, visuallyHiddenInput } from "../../internals/utils/visuallyHidden";
import type { ChangeEventCustomProperties, EventWithOptionalKeyState, IncrementValueParameters } from "../utils/types";
import { NumberFieldRootContext, useNumberFieldRootContext, type InputMode } from "./NumberFieldRootContext";

function isIOS(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Groups all parts of the number field and manages its state.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Number Field](https://rebase-ui.knst.dev/components/number-field)
 */
export function NumberFieldRoot<T extends JSX.ElementType = "div">(props: NumberFieldRoot.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "id",
    "min",
    "max",
    "smallStep",
    "step",
    "largeStep",
    "required",
    "disabled",
    "readOnly",
    "form",
    "name",
    "defaultValue",
    "value",
    "onValueChange",
    "onValueCommitted",
    "allowWheelScrub",
    "snapOnStep",
    "allowOutOfRange",
    "format",
    "locale",
    "inputRef",
    "class",
    "style",
    "children",
    "ref",
  );
  // Deliberately not hoisted: reading the children getter here would create the child
  // components in this body, outside the context provider below. It is passed through
  // JSX instead, so the children are created inside the provider by NumberFieldRootContent.
  const field = useFieldRootContext();
  const form = useFormContext();
  const parentLabelable = useLabelableContext();
  const { clearErrors } = form;
  const { setDirty, validityData, setFilled, validation } = field;
  const fieldDisabled = field.disabled;
  const fieldName = field.name;
  const fieldState = field.state;

  function disabled(): boolean {
    return fieldDisabled() === true || props.disabled === true;
  }

  function required(): boolean {
    return props.required ?? false;
  }

  function readOnly(): boolean {
    return props.readOnly ?? false;
  }

  function name(): string | undefined {
    return fieldName() ?? props.name;
  }

  function nameProp(): string | undefined {
    return props.name;
  }

  function stepValue(): number {
    const step = props.step;
    return step === "any" ? 1 : (step ?? 1);
  }

  function minWithDefault(): number {
    return props.min ?? Number.MIN_SAFE_INTEGER;
  }

  function maxWithDefault(): number {
    return props.max ?? Number.MAX_SAFE_INTEGER;
  }

  function minWithZeroDefault(): number {
    return props.min ?? 0;
  }

  function formatStyle(): Intl.NumberFormatOptions["style"] {
    return props.format?.style;
  }

  function min(): number | undefined {
    return props.min;
  }

  function max(): number | undefined {
    return props.max;
  }

  function format(): Intl.NumberFormatOptions | undefined {
    return props.format;
  }

  function locale(): Intl.LocalesArgument | undefined {
    return props.locale;
  }

  const scrubState = store({ scrubbing: false });
  function scrubbing(): boolean {
    return scrubState.scrubbing;
  }
  function setIsScrubbing(next: boolean): void {
    scrubState.scrubbing = next;
  }

  const inputElementState = store({ element: null as HTMLInputElement | null });
  function inputElement(): HTMLInputElement | null {
    return inputElementState.element;
  }
  function setInputElement(element: HTMLInputElement | null): void {
    inputElementState.element = element;
  }

  const inputModeState = store({ mode: "numeric" as InputMode });
  function inputMode(): InputMode {
    return inputModeState.mode;
  }

  const id = createLabelableId({ id: () => props.id || undefined });

  const [valueUnwrapped, setValueUnwrapped] = createControllableSignal<number | null>({
    value: () => props.value,
    defaultValue: () => props.defaultValue ?? null,
  });

  function value(): number | null {
    return valueUnwrapped() ?? null;
  }

  // Synchronous mirrors of the (microtask-batched) signals, so event logic that reads state
  // right after writing it sees the fresh value, mirroring the upstream refs.
  const valueRef = { current: value() };
  const lastChangedValueRef = { current: null as number | null };
  const hasPendingCommitRef = { current: false };
  const allowInputSyncRef = { current: true };

  // During SSR, the value is formatted on the server, whose locale may differ from the client's
  // locale. This causes a hydration mismatch, which is manually suppressed on the input. This is
  // preferable to rendering an empty input field and then updating it with the formatted value,
  // as the user can still see the value prior to hydration, even if it's not formatted correctly.
  const inputTextState = store({ value: formatNumber(value(), props.locale, props.format) });
  let inputValueSnapshot = inputTextState.value;
  function setInputValue(next: string | ((prev: string) => string)): void {
    const resolved = typeof next === "function" ? (next as (prev: string) => string)(inputValueSnapshot) : next;
    inputValueSnapshot = resolved;
    inputTextState.value = resolved;
  }
  function inputValue(): string {
    return inputTextState.value;
  }

  function getAllowedNonNumericKeys(): Set<string> {
    const localeValue = locale();
    const formatValue = format();
    const parts = getFormatParts(localeValue, formatValue);

    const keys = new Set<string>(BASE_NON_NUMERIC_SYMBOLS);
    const addAll = (chars: readonly string[]) => chars.forEach((char) => keys.add(char));

    // Integer formats omit the decimal from `parts`, so fall back to the locale's separator in that
    // case; it must stay typeable regardless of whether the format renders a fraction.
    const decimal = parts.find((part) => part.type === "decimal")?.value ?? getNumberLocaleDetails(localeValue, formatValue).decimal;
    keys.add(decimal);

    // Allow every non-digit character the formatter renders — separators, currency symbols, units
    // (e.g. `km/h`, `°C`), exponent separators, and locale literals — decomposed per character
    // because the input validates the typed string one character at a time.
    parts.forEach((part) => {
      if (part.type === "integer" || part.type === "fraction" || part.type === "exponentInteger" || part.type === "compact") {
        return;
      }
      addAll(Array.from(part.value));
      if (SPACE_SEPARATOR_RE.test(part.value)) {
        keys.add(" ");
      }
    });

    const allowPercentSymbols = formatStyle() === "percent" || (formatStyle() === "unit" && formatValue?.unit === "percent");
    const allowPermilleSymbols = formatStyle() === "percent" || (formatStyle() === "unit" && formatValue?.unit === "permille");

    // Tolerate percent/permille variants the formatter doesn't emit but users may type or paste.
    if (allowPercentSymbols) {
      addAll(PERCENTAGES);
    }
    if (allowPermilleSymbols) {
      addAll(PERMILLE);
    }

    // Allow plus sign in all cases; minus sign when negatives are valid, or when out-of-range
    // entry is allowed so native underflow validation can be triggered from the keyboard.
    addAll(PLUS_SIGNS_WITH_ASCII);
    if (minWithDefault() < 0 || props.allowOutOfRange === true) {
      addAll(MINUS_SIGNS_WITH_ASCII);
    }

    return keys;
  }

  function getStepAmount(event?: EventWithOptionalKeyState): number {
    if (event?.altKey) {
      return props.smallStep ?? 0.1;
    }
    if (event?.shiftKey) {
      return props.largeStep ?? 10;
    }
    return stepValue();
  }

  function handleValueCommitted(nextValue: number | null, eventDetails: NumberFieldRoot.CommitEventDetails): void {
    hasPendingCommitRef.current = false;
    props.onValueCommitted?.(nextValue, eventDetails);
  }

  function setValue(unvalidatedValue: number | null, details: NumberFieldRoot.ChangeEventDetails): boolean {
    const eventWithOptionalKeyState = details.event as EventWithOptionalKeyState | undefined;
    const dir = details.direction;

    // Direct text entry (typing, pasting, clearing, autofill) behaves natively; step-based
    // interactions (keyboard arrows, buttons, wheel, scrub) do not. All direct-entry reasons
    // (`input-change`, `input-clear`, `input-blur`, `input-paste`) share the `input-` prefix.
    const isInputReason = details.reason.startsWith("input-") || details.reason === REASONS.none;

    // Only allow out-of-range values for direct text entry. Step-based interactions still clamp.
    const shouldClampValue = props.allowOutOfRange !== true || !isInputReason;

    const validatedValue = toValidatedNumber(
      unvalidatedValue,
      dir ? getStepAmount(eventWithOptionalKeyState) * dir : undefined,
      minWithDefault(),
      maxWithDefault(),
      minWithZeroDefault(),
      props.format,
      props.snapOnStep ?? false,
      eventWithOptionalKeyState?.altKey ?? false,
      shouldClampValue,
    );

    // Notify about a change even when the numeric value is unchanged for input reasons: the
    // typed text may clamp/snap to the current value, or differ while validation normalizes
    // it back to the existing value.
    const shouldFireChange =
      validatedValue !== valueRef.current ||
      (isInputReason && (unvalidatedValue !== valueRef.current || allowInputSyncRef.current === false));

    if (shouldFireChange) {
      props.onValueChange?.(validatedValue, details);

      if (details.isCanceled) {
        // Report a vetoed change as not applied, so callers don't commit a value never stored.
        return false;
      }

      // Keep the synchronous mirror fresh only when uncontrolled: in controlled mode the prop
      // is the source of truth and the mirror resyncs from it after flush (mirroring the
      // upstream render-synced ref), so stepping continues from the applied prop value.
      if (props.value === undefined) {
        valueRef.current = validatedValue;
      }
      setValueUnwrapped(validatedValue);
      setDirty(validatedValue !== validityData.initialValue);
      hasPendingCommitRef.current = true;
    }

    lastChangedValueRef.current = validatedValue;

    // Keep the visible input in sync immediately when programmatic changes occur
    // (increment/decrement, wheel, etc). During direct typing we don't want
    // to overwrite the user-provided text until blur, so we gate on
    // `allowInputSyncRef`.
    if (allowInputSyncRef.current) {
      setInputValue(formatNumber(validatedValue, props.locale, props.format));
    }

    return shouldFireChange;
  }

  function incrementValue(amount: number, { direction, currentValue, event, reason }: IncrementValueParameters): boolean {
    const prevValue = currentValue == null ? valueRef.current : currentValue;

    if (typeof prevValue !== "number") {
      // Seed an empty field with 0; `setValue` clamps it to the in-range value nearest 0
      // (e.g. `max` for a negative range). No `direction`: the seed isn't a step, so it must
      // not be directionally snapped.
      return setValue(0, createChangeEventDetails(reason, event as never));
    }

    return setValue(
      prevValue + amount * direction,
      createChangeEventDetails(reason, event as never, undefined, {
        direction,
      }),
    );
  }

  // Sync the formatted input text and the filled state when the value (or its formatting)
  // changes. During direct typing the input keeps authority over its own text until blur.
  // Field validation (`clearErrors`/`validation.change`) runs from the input's value effect,
  // mirroring the upstream `useValueChanged` wiring.
  effect(() => {
    const current = value();
    const text = formatNumber(current, props.locale, props.format);

    // The sync below only writes, so the effect tracks just the value and formatting above.
    untrack(() => {
      valueRef.current = current;
      setFilled(current !== null);

      if (!allowInputSyncRef.current) {
        return;
      }

      if (text !== inputValueSnapshot) {
        setInputValue(text);
      }
    });
  });

  effect(() => {
    const minValue = minWithDefault();

    untrack(() => {
      if (!isIOS()) {
        return;
      }

      // iOS numeric software keyboard doesn't have a minus key, so we need to use the default
      // keyboard to let the user input a negative number.
      let computedInputMode: InputMode = "text";

      if (minValue >= 0) {
        // iOS numeric software keyboard doesn't have a decimal key for "numeric" input mode, but
        // this is better than the "text" input if possible to use.
        computedInputMode = "decimal";
      }

      inputModeState.mode = computedInputMode;
    });
  });

  // Programmatic focus leaves the caret at the start (Chrome/Firefox) or selects the whole value
  // (Safari). Store the caret at the end before focusing: every engine restores the stored
  // selection on `focus()`, and a selection the consumer sets in `onFocus` still wins. Keyboard
  // and pointer focus keep the browser's native selection behavior.
  function focusInput(): void {
    const input = inputElement();
    if (!input) {
      return;
    }
    const length = input.value.length;
    input.setSelectionRange(length, length);
    input.focus();
  }

  // The `wheel` listener must be non-passive so `preventDefault` can stop page scrolling.
  // It is attached natively to the input instead of via JSX for the same reason.
  effect(() => {
    const element = inputElement();
    const isDisabled = disabled();
    const isReadOnly = readOnly();
    const scrub = props.allowWheelScrub ?? false;

    untrack(() => {
      if (isDisabled || isReadOnly || !scrub || !element) {
        return;
      }

      // Capture the narrowed element for the listener closure below.
      const target = element;

      function handleWheel(event: WheelEvent): void {
        if (
          // Allow pinch-zooming.
          event.ctrlKey ||
          target.ownerDocument.activeElement !== target
        ) {
          return;
        }

        // Some browsers deliver shift + wheel on the horizontal axis, so there the horizontal
        // delta is the intended vertical one. Touchpads emit sub-pixel noise on the cross axis,
        // so compare the axes rather than requiring an exact zero.
        const isHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
        const delta = event.shiftKey && isHorizontal ? event.deltaX : event.deltaY;

        // Ignore horizontal gestures so the page can scroll instead of scrubbing. Shift is exempt:
        // its gesture is horizontal wherever the browser swaps the axis.
        if (delta === 0 || (!event.shiftKey && isHorizontal)) {
          return;
        }

        // Prevent the default behavior to avoid scrolling the page.
        event.preventDefault();
        allowInputSyncRef.current = true;

        const amount = getStepAmount(event);

        // Each wheel turn is a discrete, final change, so commit it immediately like keyboard
        // steps (gated on an actual change so boundary no-ops don't commit).
        const changed = incrementValue(amount, {
          direction: delta > 0 ? -1 : 1,
          event,
          reason: REASONS.wheel,
        });
        if (changed) {
          handleValueCommitted(lastChangedValueRef.current, createGenericEventDetails(REASONS.wheel, event));
        }
      }

      target.addEventListener("wheel", handleWheel, { passive: false });
      onCleanup(() => {
        target.removeEventListener("wheel", handleWheel);
      });
    });
  });

  const state: NumberFieldRootStateSelectors = {
    ...fieldState,
    disabled,
    required,
    readOnly,
    value,
    inputValue,
    scrubbing,
  };

  const contextValue: NumberFieldRootContext = {
    inputElement,
    setInputElement,
    focusInput,
    minWithDefault,
    maxWithDefault,
    id,
    setValue,
    incrementValue,
    getStepAmount,
    allowInputSyncRef,
    valueRef,
    lastChangedValueRef,
    hasPendingCommitRef,
    name,
    nameProp,
    inputMode,
    getAllowedNonNumericKeys,
    min,
    max,
    setInputValue,
    format,
    inputValue,
    value,
    locale,
    setIsScrubbing,
    state,
    onValueCommitted: handleValueCommitted,
  };

  function snapshot(): NumberFieldRootState {
    return getNumberFieldStateSnapshot(state);
  }

  function registerHiddenInput(element: HTMLInputElement | null): void {
    if (element) {
      validation.inputElement = element;
      validation.registerInput(element, {
        get controlElement() {
          return inputElement();
        },
        value: undefined,
      });
    }
  }

  const hiddenRef = mergeRefs(props.inputRef as ((element: HTMLInputElement | null) => void) | undefined, registerHiddenInput);

  const hiddenValidationProps = validation.getValidationProps(disabled, {});

  function handleHiddenFocus(): void {
    focusInput();
  }

  function handleHiddenChange(event: Event): void {
    // Workaround for https://github.com/react/react/issues/9023
    if (event.defaultPrevented || disabled() || readOnly()) {
      return;
    }

    // Handle browser autofill.
    const nextValue = (event.currentTarget as HTMLInputElement).valueAsNumber;
    const parsedValue = Number.isNaN(nextValue) ? null : nextValue;
    const details = createChangeEventDetails(REASONS.none, event);

    // `setValue` updates the dirty flag from the stored (clamped) value, so validate with
    // that same value rather than the raw autofilled one.
    setValue(parsedValue, details);
    clearErrors(name());
    validation.change(lastChangedValueRef.current ?? parsedValue);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // The providers live inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the number field parts without context. The
  // field, form, and parent labelable scopes are re-provided by identity so parts
  // keep seeing the enclosing field. Children resolve in NumberFieldRootContent below
  // so they are created inside the providers.
  return (
    <>
      <Tag
        {...(rest as Record<string, unknown>)}
        data-disabled={disabled() ? "" : undefined}
        data-readonly={readOnly() ? "" : undefined}
        data-required={required() ? "" : undefined}
        data-scrubbing={scrubbing() ? "" : undefined}
        data-valid={fieldState.valid() === true ? "" : undefined}
        data-invalid={fieldState.valid() === false ? "" : undefined}
        data-touched={fieldState.touched() ? "" : undefined}
        data-dirty={fieldState.dirty() ? "" : undefined}
        data-filled={fieldState.filled() ? "" : undefined}
        data-focused={fieldState.focused() ? "" : undefined}
        data-validating={fieldState.validating() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        <FieldRootContext value={field}>
          <FormContext value={form}>
            <LabelableContext value={parentLabelable}>
              <NumberFieldRootContext value={contextValue}>
                <NumberFieldRootContent>{props.children}</NumberFieldRootContent>
              </NumberFieldRootContext>
            </LabelableContext>
          </FormContext>
        </FieldRootContext>
      </Tag>
      <input
        aria-invalid={hiddenValidationProps["aria-invalid"]}
        aria-describedby={hiddenValidationProps["aria-describedby"]}
        ref={hiddenRef}
        type="number"
        form={props.form}
        name={name()}
        value={value() == null ? "" : String(value())}
        min={props.min}
        max={props.max}
        // stepMismatch validation is broken unless an explicit `min` is added.
        // See https://github.com/react/react/issues/12334.
        step={props.step}
        bool:disabled={disabled()}
        readonly={readOnly()}
        required={required()}
        aria-hidden="true"
        tabindex={-1}
        style={name() ? visuallyHiddenInput : visuallyHidden}
        onFocus={handleHiddenFocus}
        onChange={handleHiddenChange}
      />
    </>
  );
}

/**
 * Resolves the root children inside the number field context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the field state changes, matching the Solid layer where the
 * children memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function NumberFieldRootContent(props: { children: ChildrenValue<NumberFieldRootState> }) {
  const children = props.children;

  const { state } = useNumberFieldRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: NumberFieldRootState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the number field context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot = getNumberFieldStateSnapshot(state);

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface NumberFieldRootState extends FieldRootState {
  /**
   * The raw numeric value of the field.
   */
  value: number | null;
  /**
   * The formatted string value presented in the input element.
   */
  inputValue: string;
  /**
   * Whether the user must enter a value before submitting a form.
   */
  required: boolean;
  /**
   * Whether the user should be unable to change the field value.
   */
  readOnly: boolean;
  /**
   * Whether the user is currently scrubbing the field.
   */
  scrubbing: boolean;
}

/**
 * Selector record behind the number field state snapshot. Parts spread the root
 * selectors and override `disabled`, then resolve a snapshot per binding.
 */
export interface NumberFieldRootStateSelectors extends FieldRootStateSelectors {
  value: () => number | null;
  inputValue: () => string;
  required: () => boolean;
  readOnly: () => boolean;
  scrubbing: () => boolean;
}

/**
 * Resolves a plain state snapshot from the selectors. Called inside JSX
 * bindings (and the state thunk passed to render functions) so each read
 * subscribes the binding to the selector it came from.
 */
export function getNumberFieldStateSnapshot(state: NumberFieldRootStateSelectors): NumberFieldRootState {
  return {
    ...getFieldStateSnapshot(state),
    value: state.value(),
    inputValue: state.inputValue(),
    required: state.required(),
    readOnly: state.readOnly(),
    scrubbing: state.scrubbing(),
  };
}

export interface NumberFieldRootOwnProps {
  /**
   * The id of the input element.
   */
  id?: string | undefined;
  /**
   * The minimum value of the input element.
   */
  min?: number | undefined;
  /**
   * The maximum value of the input element.
   */
  max?: number | undefined;
  /**
   * When true, direct text entry may be outside the `min`/`max` range without clamping,
   * so native range underflow/overflow validation can occur.
   * Step-based interactions (keyboard arrows, buttons, wheel, scrub) still clamp.
   * @default false
   */
  allowOutOfRange?: boolean | undefined;
  /**
   * The small step value of the input element when incrementing while the alt key is held.
   * Snaps to multiples of this value when `snapOnStep` is enabled.
   * @default 0.1
   */
  smallStep?: number | undefined;
  /**
   * Amount to increment and decrement with the buttons and arrow keys, or to scrub with pointer movement in the scrub area.
   * To always enable step validation on form submission, specify the `min` prop explicitly in conjunction with this prop.
   * Specify `step="any"` to always disable step validation; interactive stepping then uses a base amount of `1`, while the alt and shift keys still step by `smallStep` and `largeStep`.
   * @default 1
   */
  step?: number | "any" | undefined;
  /**
   * The large step value of the input element when incrementing while the shift key is held.
   * Snaps to multiples of this value when `snapOnStep` is enabled.
   * @default 10
   */
  largeStep?: number | undefined;
  /**
   * Whether the user must enter a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to change the field value.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the number field is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The raw numeric value of the field.
   */
  value?: number | null | undefined;
  /**
   * The uncontrolled value of the field when it's initially rendered.
   *
   * To render a controlled number field, use the `value` prop instead.
   */
  defaultValue?: number | undefined;
  /**
   * Whether to allow the user to scrub the input value with the mouse wheel while focused and
   * hovering over the input.
   * @default false
   */
  allowWheelScrub?: boolean | undefined;
  /**
   * Whether the value should snap to the nearest step when incrementing or decrementing.
   * @default false
   */
  snapOnStep?: boolean | undefined;
  /**
   * Options to format the input value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * Callback fired when the number value changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   * - `'input-change'` for parseable typing or programmatic text updates
   * - `'input-clear'` when the field becomes empty
   * - `'input-blur'` when formatting (and clamping, if enabled) occurs on blur
   * - `'input-paste'` for paste interactions
   * - `'keyboard'` for arrow-key/Home/End stepping (typing digits uses `'input-change'`/`'input-clear'`)
   * - `'increment-press'` / `'decrement-press'` for button presses on the increment and decrement controls
   * - `'wheel'` for wheel-based scrubbing
   * - `'scrub'` for scrub area drags
   */
  onValueChange?: ((value: number | null, eventDetails: NumberFieldRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Callback function that is fired when the value is committed.
   * It runs later than `onValueChange`, when:
   * - The input is blurred after typing a value.
   * - The pointer is released after scrubbing or pressing the increment/decrement buttons.
   *
   * It runs simultaneously with `onValueChange` when interacting with the keyboard or the
   * mouse wheel.
   *
   * **Warning**: This is a generic event not a change event.
   */
  onValueCommitted?: ((value: number | null, eventDetails: NumberFieldRoot.CommitEventDetails) => void) | undefined;
  /**
   * The locale of the input element.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: ((element: HTMLInputElement | null) => void) | undefined;
}

export type NumberFieldRootProps<T extends JSX.ElementType = "div"> = NumberFieldRootOwnProps &
  RebaseUIComponentProps<T, NumberFieldRootState>;

export type NumberFieldRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.inputBlur
  | typeof REASONS.inputPaste
  | typeof REASONS.keyboard
  | typeof REASONS.incrementPress
  | typeof REASONS.decrementPress
  | typeof REASONS.wheel
  | typeof REASONS.scrub
  | typeof REASONS.none;
export type NumberFieldRootChangeEventDetails = RebaseUIChangeEventDetails<NumberFieldRootChangeEventReason, ChangeEventCustomProperties>;

// `none` is kept for consistency with other components even though the number field never
// commits with it.
export type NumberFieldRootCommitEventReason =
  | typeof REASONS.inputBlur
  | typeof REASONS.inputClear
  | typeof REASONS.keyboard
  | typeof REASONS.incrementPress
  | typeof REASONS.decrementPress
  | typeof REASONS.wheel
  | typeof REASONS.scrub
  | typeof REASONS.none;
export type NumberFieldRootCommitEventDetails = RebaseUIGenericEventDetails<NumberFieldRootCommitEventReason>;

export namespace NumberFieldRoot {
  export type State = NumberFieldRootState;
  export type Props<T extends JSX.ElementType = "div"> = NumberFieldRootProps<T>;
  export type ChangeEventReason = NumberFieldRootChangeEventReason;
  export type ChangeEventDetails = NumberFieldRootChangeEventDetails;
  export type CommitEventReason = NumberFieldRootCommitEventReason;
  export type CommitEventDetails = NumberFieldRootCommitEventDetails;
}
