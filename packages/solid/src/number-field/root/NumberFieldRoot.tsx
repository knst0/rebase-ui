import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createSignal, untrack } from "solid-js";

import type { FieldRootState } from "../../field/root/FieldRoot";
import { createControllableSignal } from "../../internals/createControllableSignal";
import {
  createChangeEventDetails,
  createGenericEventDetails,
  REASONS,
  type RebaseUIChangeEventDetails,
  type RebaseUIGenericEventDetails,
} from "../../internals/event-details";
import { useFieldRootContext } from "../../internals/field-root-context";
import { useFormContext } from "../../internals/form-context";
import { createLabelableId } from "../../internals/labelable-provider";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument } from "../../internals/utils/owner";
import { visuallyHidden, visuallyHiddenInput } from "../../internals/utils/visuallyHidden";
import { formatNumber } from "../../slider/utils/formatNumber";
import {
  BASE_NON_NUMERIC_SYMBOLS,
  getFormatParts,
  getNumberLocaleDetails,
  MINUS_SIGNS_WITH_ASCII,
  PERCENTAGES,
  PERMILLE,
  PLUS_SIGNS_WITH_ASCII,
  SPACE_SEPARATOR_RE,
} from "../utils/parse";
import { stateAttributesMapping } from "../utils/stateAttributesMapping";
import type { ChangeEventCustomProperties, EventWithOptionalKeyState, IncrementValueParameters } from "../utils/types";
import { toValidatedNumber } from "../utils/validate";
import { NumberFieldRootContext, type InputMode } from "./NumberFieldRootContext";

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
export function NumberFieldRoot<T extends ValidComponent = "div">(props: NumberFieldRoot.Props<T>) {
  const [local, elementProps] = split(props as NumberFieldRoot.Props, { default: defaultProps }, [
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
  ]);

  const as = untrack(() => local.as);
  const inputRefProp = untrack(() => local.inputRef);

  const {
    setDirty,
    validityData,
    disabled: fieldDisabled,
    setFilled,
    name: fieldName,
    state: fieldState,
    validation,
  } = useFieldRootContext();
  const { clearErrors } = useFormContext();

  const disabled = createMemo(() => fieldDisabled() === true || local.disabled === true);
  const name = () => fieldName() ?? local.name;
  const stepValue = () => (local.step === "any" ? 1 : (local.step ?? 1));

  const [isScrubbing, setIsScrubbing] = createSignal(false);

  const minWithDefault = () => local.min ?? Number.MIN_SAFE_INTEGER;
  const maxWithDefault = () => local.max ?? Number.MAX_SAFE_INTEGER;
  const minWithZeroDefault = () => local.min ?? 0;
  const formatStyle = () => local.format?.style;

  const [inputElement, setInputElement] = createSignal<HTMLInputElement | null>(null);

  const id = createLabelableId({ id: () => local.id || undefined });

  const [valueUnwrapped, setValueUnwrapped] = createControllableSignal<number | null>({
    value: () => local.value,
    defaultValue: () => local.defaultValue ?? null,
  });

  const value = () => valueUnwrapped() ?? null;

  // Synchronous mirrors of the (microtask-batched) signals, so event logic that reads state
  // right after writing it sees the fresh value, mirroring the upstream refs.
  const valueRef = { current: untrack(value) as number | null };
  const lastChangedValueRef = { current: null as number | null };
  const hasPendingCommitRef = { current: false };
  const allowInputSyncRef = { current: true };

  // During SSR, the value is formatted on the server, whose locale may differ from the client's
  // locale. This causes a hydration mismatch, which is manually suppressed on the input. This is
  // preferable to rendering an empty input field and then updating it with the formatted value,
  // as the user can still see the value prior to hydration, even if it's not formatted correctly.
  const [inputValueSignal, setInputValueSignal] = createSignal(untrack(() => formatNumber(value(), local.locale, local.format)));
  let inputValueSnapshot = untrack(inputValueSignal);
  const setInputValue = (next: string | ((prev: string) => string)) => {
    const resolved = typeof next === "function" ? (next as (prev: string) => string)(inputValueSnapshot) : next;
    inputValueSnapshot = resolved;
    setInputValueSignal(resolved);
  };
  const inputValue = () => inputValueSignal();

  const [inputMode, setInputMode] = createSignal<InputMode>("numeric");

  function getAllowedNonNumericKeys(): Set<string> {
    const locale = untrack(() => local.locale);
    const format = untrack(() => local.format);
    const parts = getFormatParts(locale, format);

    const keys = new Set<string>(BASE_NON_NUMERIC_SYMBOLS);
    const addAll = (chars: readonly string[]) => chars.forEach((char) => keys.add(char));

    // Integer formats omit the decimal from `parts`, so fall back to the locale's separator in that
    // case; it must stay typeable regardless of whether the format renders a fraction.
    const decimal = parts.find((part) => part.type === "decimal")?.value ?? getNumberLocaleDetails(locale, format).decimal;
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

    const allowPercentSymbols = formatStyle() === "percent" || (formatStyle() === "unit" && format?.unit === "percent");
    const allowPermilleSymbols = formatStyle() === "percent" || (formatStyle() === "unit" && format?.unit === "permille");

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
    if (minWithDefault() < 0 || untrack(() => local.allowOutOfRange)) {
      addAll(MINUS_SIGNS_WITH_ASCII);
    }

    return keys;
  }

  function getStepAmount(event?: EventWithOptionalKeyState): number {
    if (event?.altKey) {
      return untrack(() => local.smallStep);
    }
    if (event?.shiftKey) {
      return untrack(() => local.largeStep);
    }
    return stepValue();
  }

  function handleValueCommitted(nextValue: number | null, eventDetails: NumberFieldRoot.CommitEventDetails) {
    hasPendingCommitRef.current = false;
    untrack(() => local.onValueCommitted)?.(nextValue, eventDetails);
  }

  function setValue(unvalidatedValue: number | null, details: NumberFieldRoot.ChangeEventDetails): boolean {
    const eventWithOptionalKeyState = details.event as EventWithOptionalKeyState | undefined;
    const dir = details.direction;

    // Direct text entry (typing, pasting, clearing, autofill) behaves natively; step-based
    // interactions (keyboard arrows, buttons, wheel, scrub) do not. All direct-entry reasons
    // (`input-change`, `input-clear`, `input-blur`, `input-paste`) share the `input-` prefix.
    const isInputReason = details.reason.startsWith("input-") || details.reason === REASONS.none;

    // Only allow out-of-range values for direct text entry. Step-based interactions still clamp.
    const shouldClampValue = !untrack(() => local.allowOutOfRange) || !isInputReason;

    const validatedValue = toValidatedNumber(
      unvalidatedValue,
      dir ? getStepAmount(eventWithOptionalKeyState) * dir : undefined,
      minWithDefault(),
      maxWithDefault(),
      minWithZeroDefault(),
      untrack(() => local.format),
      untrack(() => local.snapOnStep),
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
      untrack(() => local.onValueChange)?.(validatedValue, details);

      if (details.isCanceled) {
        // Report a vetoed change as not applied, so callers don't commit a value never stored.
        return false;
      }

      // Keep the synchronous mirror fresh only when uncontrolled: in controlled mode the prop
      // is the source of truth and the mirror resyncs from it after flush (mirroring the
      // upstream render-synced ref), so stepping continues from the applied prop value.
      if (untrack(() => local.value) === undefined) {
        valueRef.current = validatedValue;
      }
      setValueUnwrapped(validatedValue);
      setDirty(validatedValue !== untrack(() => validityData.initialValue));
      hasPendingCommitRef.current = true;
    }

    lastChangedValueRef.current = validatedValue;

    // Keep the visible input in sync immediately when programmatic changes occur
    // (increment/decrement, wheel, etc). During direct typing we don't want
    // to overwrite the user-provided text until blur, so we gate on
    // `allowInputSyncRef`.
    if (allowInputSyncRef.current) {
      setInputValue(
        formatNumber(
          validatedValue,
          untrack(() => local.locale),
          untrack(() => local.format),
        ),
      );
    }

    return shouldFireChange;
  }

  function incrementValue(amount: number, { direction, currentValue, event, reason }: IncrementValueParameters) {
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
  createEffect(
    () => ({ current: value(), text: formatNumber(value(), local.locale, local.format) }),
    ({ current, text }) => {
      valueRef.current = current;
      setFilled(current !== null);

      if (!allowInputSyncRef.current) {
        return;
      }

      if (text !== inputValueSnapshot) {
        setInputValue(text);
      }
    },
  );

  createEffect(
    () => minWithDefault(),
    (min) => {
      if (!isIOS()) {
        return;
      }

      // iOS numeric software keyboard doesn't have a minus key, so we need to use the default
      // keyboard to let the user input a negative number.
      let computedInputMode: InputMode = "text";

      if (min >= 0) {
        // iOS numeric software keyboard doesn't have a decimal key for "numeric" input mode, but
        // this is better than the "text" input if possible to use.
        computedInputMode = "decimal";
      }

      setInputMode(computedInputMode);
    },
  );

  // Programmatic focus leaves the caret at the start (Chrome/Firefox) or selects the whole value
  // (Safari). Store the caret at the end before focusing: every engine restores the stored
  // selection on `focus()`, and a selection the consumer sets in `onFocus` still wins. Keyboard
  // and pointer focus keep the browser's native selection behavior.
  function focusInput() {
    const input = untrack(inputElement);
    if (!input) {
      return;
    }
    const length = input.value.length;
    input.setSelectionRange(length, length);
    input.focus();
  }

  // The `wheel` listener must be non-passive so `preventDefault` can stop page scrolling.
  // It is attached natively to the input instead of via JSX for the same reason.
  createEffect(
    () => ({ element: inputElement(), isDisabled: disabled(), isReadOnly: local.readOnly, scrub: local.allowWheelScrub }),
    ({ element, isDisabled, isReadOnly, scrub }) => {
      if (isDisabled || isReadOnly || !scrub || !element) {
        return;
      }

      function handleWheel(event: WheelEvent) {
        if (
          // Allow pinch-zooming.
          event.ctrlKey ||
          ownerDocument(element).activeElement !== element
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

      element.addEventListener("wheel", handleWheel, { passive: false });
      return () => {
        element.removeEventListener("wheel", handleWheel);
      };
    },
  );

  const state: NumberFieldRootState = {
    ...fieldState,
    disabled,
    readOnly: () => local.readOnly,
    required: () => local.required,
    value,
    inputValue,
    scrubbing: isScrubbing,
  };

  const contextValue: NumberFieldRootContext = {
    inputElement,
    setInputElement: (element) => setInputElement(element),
    focusInput,
    minWithDefault: () => minWithDefault(),
    maxWithDefault: () => maxWithDefault(),
    id,
    setValue,
    incrementValue,
    getStepAmount,
    allowInputSyncRef,
    valueRef,
    lastChangedValueRef,
    hasPendingCommitRef,
    name,
    nameProp: () => local.name,
    inputMode,
    getAllowedNonNumericKeys,
    min: () => local.min,
    max: () => local.max,
    setInputValue: (next) => setInputValue(next),
    format: () => local.format,
    inputValue,
    value,
    locale: () => local.locale,
    setIsScrubbing,
    state,
    onValueCommitted: handleValueCommitted,
  };

  const registerHiddenInput = (element: HTMLInputElement | null) => {
    if (element) {
      validation.inputElement = element;
      validation.registerInput(element, {
        get controlElement() {
          return inputElement();
        },
        value: undefined,
      });
    }
  };

  const hiddenInputValidationProps = createMemo(() =>
    validation.getValidationProps(disabled(), {
      onFocus: () => {
        focusInput();
      },
      onChange: (event: Event) => {
        // Workaround for https://github.com/react/react/issues/9023
        if (event.defaultPrevented || untrack(disabled) || untrack(() => local.readOnly)) {
          return;
        }

        // Handle browser autofill.
        const nextValue = (event.currentTarget as HTMLInputElement).valueAsNumber;
        const parsedValue = Number.isNaN(nextValue) ? null : nextValue;
        const details = createChangeEventDetails(REASONS.none, event);

        // `setValue` updates the dirty flag from the stored (clamped) value, so validate with
        // that same value rather than the raw autofilled one.
        setValue(parsedValue, details);
        clearErrors(untrack(name));
        validation.change(lastChangedValueRef.current ?? parsedValue);
      },
    }),
  );

  return (
    <NumberFieldRootContext value={contextValue}>
      <RenderElement as={as} state={state} props={elementProps} stateAttributesMapping={stateAttributesMapping} />
      <input
        {...hiddenInputValidationProps()}
        ref={mergeRefs(inputRefProp, registerHiddenInput)}
        type="number"
        form={local.form}
        name={name()}
        value={value() == null ? "" : String(value())}
        min={local.min}
        max={local.max}
        // stepMismatch validation is broken unless an explicit `min` is added.
        // See https://github.com/react/react/issues/12334.
        step={local.step}
        disabled={disabled() || undefined}
        readonly={local.readOnly}
        required={local.required}
        aria-hidden="true"
        tabindex={-1}
        style={name() ? visuallyHiddenInput : visuallyHidden}
      />
    </NumberFieldRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  smallStep: 0.1,
  step: 1,
  largeStep: 10,
  required: false,
  disabled: false,
  readOnly: false,
  allowWheelScrub: false,
  snapOnStep: false,
  allowOutOfRange: false,
} satisfies Partial<NumberFieldRoot.Props>);

export interface NumberFieldRootState extends FieldRootState {
  /**
   * The raw numeric value of the field.
   */
  value: Accessor<number | null>;
  /**
   * The formatted string value presented in the input element.
   */
  inputValue: Accessor<string>;
  /**
   * Whether the user must enter a value before submitting a form.
   */
  required: Accessor<boolean>;
  /**
   * Whether the user should be unable to change the field value.
   */
  readOnly: Accessor<boolean>;
  /**
   * Whether the user is currently scrubbing the field.
   */
  scrubbing: Accessor<boolean>;
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

export type NumberFieldRootProps<T extends ValidComponent = "div"> = NumberFieldRootOwnProps &
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
export type NumberFieldRootCommitEventDetails = RebaseUIGenericEventDetails<NumberFieldRoot.CommitEventReason>;

export namespace NumberFieldRoot {
  export type State = NumberFieldRootState;
  export type Props<T extends ValidComponent = "div"> = NumberFieldRootProps<T>;
  export type ChangeEventReason = NumberFieldRootChangeEventReason;
  export type ChangeEventDetails = NumberFieldRootChangeEventDetails;
  export type CommitEventReason = NumberFieldRootCommitEventReason;
  export type CommitEventDetails = NumberFieldRootCommitEventDetails;
}
