import type { ValidComponent } from "@solidjs/web";
import { createEffect, untrack } from "solid-js";

import { createChangeEventDetails, createGenericEventDetails, REASONS } from "../../internals/event-details";
import { createRegisterFieldControl } from "../../internals/field-register-control";
import { useFieldRootContext } from "../../internals/field-root-context";
import { useFormContext } from "../../internals/form-context";
import { useLabelableContext } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import { formatNumber } from "../../slider/utils/formatNumber";
import type { NumberFieldRootState } from "../root/NumberFieldRoot";
import { useNumberFieldRootContext } from "../root/NumberFieldRootContext";
import {
  ANY_MINUS_DETECT_RE,
  ANY_MINUS_RE,
  ANY_PLUS_DETECT_RE,
  ANY_PLUS_RE,
  FORMAT_CONTROL_DETECT_RE,
  getNumberLocaleDetails,
  isNumeralChar,
  parseNumber,
} from "../utils/parse";
import { stateAttributesMapping } from "../utils/stateAttributesMapping";
import { hasNumberFormatRoundingOptions, removeFloatingPointErrors } from "../utils/validate";

const NAVIGATE_KEYS = new Set(["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter", "Escape"]);

/**
 * The native input control in the number field.
 * Renders an `<input>` element.
 *
 * Documentation: [Rebase UI Number Field](https://rebase-ui.knst.dev/components/number-field)
 */
export function NumberFieldInput<T extends ValidComponent = "input">(props: NumberFieldInput.Props<T>) {
  const [local, elementProps] = split(props as NumberFieldInput.Props, { default: defaultProps }, ["as"]);

  const as = untrack(() => local.as);

  const store = useNumberFieldRootContext();
  const { state } = store;
  const { disabled, readOnly, required, value, inputValue } = state;

  const { clearErrors } = useFormContext();
  const { validationMode, setTouched, setFocused, invalid, shouldValidateOnChange, validation } = useFieldRootContext();
  const { labelId } = useLabelableContext();

  let blockRevalidation = false;
  let pendingCaret: number | null = null;

  createRegisterFieldControl({
    controlElement: () => store.inputElement(),
    id: store.id,
    value: store.value,
    enabled: () => !disabled(),
    name: store.nameProp,
  });

  // After a paste splices text into the controlled value, the browser would otherwise drop the
  // caret at the end of the new value. Restore it just after the inserted text.
  createEffect(
    () => ({ text: inputValue(), element: store.inputElement() }),
    ({ element }) => {
      if (pendingCaret != null) {
        const caret = pendingCaret;
        pendingCaret = null;
        element?.setSelectionRange(caret, caret);
      }
    },
  );

  let previousValue = untrack(value);
  createEffect(
    () => value(),
    (next) => {
      if (previousValue === next) {
        return;
      }
      previousValue = next;
      clearErrors(untrack(store.name));

      if (blockRevalidation && !shouldValidateOnChange()) {
        blockRevalidation = false;
        return;
      }

      validation.change(next);
    },
  );

  const setInputRef = (element: HTMLInputElement | null) => {
    store.setInputElement(element);
  };

  const inputHandlers = (externalProps: Record<string, any>) => {
    const target: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "onFocus" || key === "onBlur" || key === "onInput" || key === "onChange" || key === "onKeyDown" || key === "onPaste") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    Object.defineProperty(target, "id", { enumerable: true, configurable: true, get: () => store.id() });
    Object.defineProperty(target, "required", { enumerable: true, configurable: true, get: () => required() });
    Object.defineProperty(target, "disabled", { enumerable: true, configurable: true, get: () => disabled() });
    Object.defineProperty(target, "readOnly", { enumerable: true, configurable: true, get: () => readOnly() });
    Object.defineProperty(target, "inputMode", { enumerable: true, configurable: true, get: () => store.inputMode() });
    Object.defineProperty(target, "value", { enumerable: true, configurable: true, get: () => inputValue() });
    Object.defineProperty(target, "aria-invalid", {
      enumerable: true,
      configurable: true,
      get: () => (!disabled() && invalid() ? true : undefined),
    });
    Object.defineProperty(target, "aria-labelledby", { enumerable: true, configurable: true, get: () => labelId() });

    target.type = "text";
    target.autoComplete = "off";
    target.autoCorrect = "off";
    target.spellCheck = "false";
    target["aria-roledescription"] = externalProps["aria-roledescription"] ?? "Number field";

    chainHandler("onFocus", (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
      // Read-only inputs are still focusable; only the value-changing handlers stay gated on it.
      if (event.defaultPrevented || untrack(disabled)) {
        return;
      }

      setFocused(true);
    });

    chainHandler("onBlur", (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
      if (event.defaultPrevented || untrack(disabled)) {
        return;
      }

      setTouched(true);
      setFocused(false);

      if (untrack(readOnly)) {
        return;
      }

      const hadManualInput = !store.allowInputSyncRef.current;
      const hadPendingProgrammaticChange = store.hasPendingCommitRef.current;

      store.allowInputSyncRef.current = true;

      const currentText = untrack(inputValue);
      const currentValue = untrack(value);

      if (currentText.trim() === "") {
        const clearDetails = createChangeEventDetails(REASONS.inputClear, event);
        store.setValue(null, clearDetails);
        // Respect a canceled clear, mirroring the non-empty blur path below.
        if (clearDetails.isCanceled) {
          return;
        }
        if (validationMode === "onBlur") {
          void validation.commit(null);
        }
        // Don't report a commit when blurring an already-empty field that the user never
        // interacted with: nothing was cleared and no programmatic change is pending.
        if (hadManualInput || hadPendingProgrammaticChange || currentValue !== null) {
          store.onValueCommitted(null, createGenericEventDetails(REASONS.inputClear, event));
        }
        return;
      }

      const formatOptions = untrack(store.format);
      const parsedValue = parseNumber(currentText, untrack(store.locale), formatOptions);
      if (parsedValue === null) {
        return;
      }

      // Avoid applying Intl's default precision unless the format opts into rounding.
      const hasRoundingOptions = hasNumberFormatRoundingOptions(formatOptions);

      let committed: number | null;
      if (!hadManualInput && !hasRoundingOptions) {
        // No rounding options and no manual edit: the visible text is purely formatted
        // display, so keep the authoritative numeric value as-is rather than re-parsing the
        // rounded text and discarding precision (e.g. focus/blur with no edits, or blur after
        // a programmatic change).
        committed = currentValue;
      } else if (hasRoundingOptions) {
        // Explicit rounding options apply to the committed value, whether typed or external.
        committed = removeFloatingPointErrors(parsedValue, formatOptions);
      } else {
        committed = parsedValue;
      }

      const nextEventDetails = createGenericEventDetails(REASONS.inputBlur, event);
      const shouldUpdateValue = currentValue !== committed;
      const shouldCommit = hadManualInput || shouldUpdateValue || hadPendingProgrammaticChange;

      // Use the stored value after `setValue` clamps it.
      let committedValue = committed;
      if (shouldUpdateValue) {
        const changeDetails = createChangeEventDetails(REASONS.inputBlur, event);
        blockRevalidation = true;
        store.setValue(committed, changeDetails);
        if (changeDetails.isCanceled) {
          blockRevalidation = false;
          return;
        }
        committedValue = store.lastChangedValueRef.current;
        // If validation normalized back to the current value, the value effect won't fire to
        // reset the flag, so reset it here or the next external change won't revalidate.
        if (committedValue === currentValue) {
          blockRevalidation = false;
        }
      }
      if (validationMode === "onBlur") {
        void validation.commit(committedValue);
      }
      if (shouldCommit) {
        store.onValueCommitted(committedValue, nextEventDetails);
      }

      // Normalize only the displayed text
      const canonicalText = formatNumber(committedValue, untrack(store.locale), formatOptions);
      if (currentText !== canonicalText) {
        store.setInputValue(canonicalText);
      }
    });

    // Solid fires `onInput` per keystroke (where upstream React's `onChange` runs); the live
    // value logic runs here. The native `onChange` below only chains external handlers.
    const handleInput = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
      if (event.defaultPrevented) {
        return;
      }

      store.allowInputSyncRef.current = false;
      const targetValue = event.currentTarget.value;

      if (targetValue.trim() === "") {
        store.setInputValue(targetValue);
        store.setValue(null, createChangeEventDetails(REASONS.inputClear, event));
        return;
      }

      // Update the input text immediately and only fire onValueChange if the typed value is
      // currently parseable into a number. This preserves good UX for IME
      // composition/partial input while still providing live numeric updates when possible.
      const allowedNonNumericKeys = store.getAllowedNonNumericKeys();
      const isValidCharacterString = Array.from(targetValue).every(
        (ch) =>
          isNumeralChar(ch) ||
          ANY_MINUS_DETECT_RE.test(ch) ||
          allowedNonNumericKeys.has(ch) ||
          // Bidi/format controls are stripped by `parseNumber`; don't let them reject the string
          // (RTL locales insert them around exponent/currency signs, e.g. scientific notation).
          FORMAT_CONTROL_DETECT_RE.test(ch),
      );

      if (!isValidCharacterString) {
        // The bound value didn't change, so the DOM keeps the rejected text; revert it to the
        // last committed text to match the controlled upstream behavior.
        event.currentTarget.value = untrack(inputValue);
        return;
      }

      const parsedValue = parseNumber(targetValue, untrack(store.locale), untrack(store.format));

      store.setInputValue(targetValue);

      if (parsedValue !== null) {
        store.setValue(parsedValue, createChangeEventDetails(REASONS.inputChange, event));
      }
    };

    target.onInput = (event: Event) => {
      makeEventPreventable(event as any);
      (externalProps.onInput as ((event: Event) => void) | undefined)?.(event);
      // React's `onChange` fires per keystroke; chain it here so Solid consumers keep that semantic.
      (externalProps.onChange as ((event: Event) => void) | undefined)?.(event);
      if ((event as any).rebaseUIHandlerPrevented || (event as Event).defaultPrevented) {
        return;
      }
      handleInput(event as InputEvent & { currentTarget: HTMLInputElement });
    };

    chainHandler("onChange", () => {
      // Solid fires `onChange` on commit (blur/Enter) rather than per keystroke: it only chains
      // external handlers. Live value logic runs from `onInput` above.
    });

    chainHandler("onKeyDown", (event: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
      if (event.defaultPrevented || untrack(readOnly) || untrack(disabled)) {
        return;
      }

      const nativeEvent = event;

      // Snapshot the dirty state without clearing it: navigation/allowed keys (ArrowLeft, Tab,
      // Enter, Escape, …) return early without changing the value, so marking the input synced
      // here would wrongly discard dirty-input authority. Only the value-changing branches below
      // mark it synced.
      const hadManualInput = !store.allowInputSyncRef.current;

      const allowedNonNumericKeys = store.getAllowedNonNumericKeys();

      let isAllowedNonNumericKey = allowedNonNumericKeys.has(event.key);

      const { decimal, currency, percentSign } = getNumberLocaleDetails(untrack(store.locale), untrack(store.format));

      const currentText = untrack(inputValue);
      const selectionStart = event.currentTarget.selectionStart;
      const selectionEnd = event.currentTarget.selectionEnd;
      const isAllSelected = selectionStart === 0 && selectionEnd === currentText.length;

      const selectionContainsIndex = (index: number) =>
        selectionStart != null && selectionEnd != null && index >= selectionStart && index < selectionEnd;

      // Only allow a single sign character: permit it when there is no existing sign of either
      // kind, when all text is selected, or when the selection covers the existing sign so it's
      // being replaced.
      const signGroups = [
        [ANY_MINUS_DETECT_RE, ANY_MINUS_RE],
        [ANY_PLUS_DETECT_RE, ANY_PLUS_RE],
      ] as const;
      signGroups.forEach(([detectRe, globalRe]) => {
        if (detectRe.test(event.key) && Array.from(allowedNonNumericKeys).some((k) => detectRe.test(k))) {
          const existingIndex = currentText.search(globalRe);
          const isReplacingExisting = existingIndex !== -1 && selectionContainsIndex(existingIndex);
          isAllowedNonNumericKey =
            !(ANY_MINUS_DETECT_RE.test(currentText) || ANY_PLUS_DETECT_RE.test(currentText)) || isAllSelected || isReplacingExisting;
        }
      });

      // Only allow one of each symbol.
      [decimal, currency, percentSign].forEach((symbol) => {
        if (event.key === symbol) {
          const symbolIndex = currentText.indexOf(symbol);
          const isSymbolHighlighted = selectionContainsIndex(symbolIndex);
          isAllowedNonNumericKey = symbolIndex === -1 || isAllSelected || isSymbolHighlighted;
        }
      });

      const isNavigateKey = NAVIGATE_KEYS.has(event.key);
      // Alt+ArrowUp/ArrowDown selects smallStep, so don't treat it as a bypass modifier.
      const isStepKey = event.key === "ArrowUp" || event.key === "ArrowDown";

      if (
        // Allow composition events (e.g., pinyin)
        // event.nativeEvent.isComposing does not work in Safari:
        // https://bugs.webkit.org/show_bug.cgi?id=165004
        (event as KeyboardEvent & { which?: number }).which === 229 ||
        (event.altKey && !isStepKey) ||
        event.ctrlKey ||
        event.metaKey ||
        isAllowedNonNumericKey ||
        isNumeralChar(event.key) ||
        isNavigateKey
      ) {
        return;
      }

      const min = untrack(store.min);
      const max = untrack(store.max);

      // Home/End jump to the corresponding bound, but only when that bound is defined.
      let boundaryValue: number | null = null;
      if (event.key === "Home" && min != null) {
        boundaryValue = min;
      } else if (event.key === "End" && max != null) {
        boundaryValue = max;
      }

      // Let the browser handle multi-character keys we don't act on (PageUp, Insert, F-keys,
      // Home/End without min/max); invalid single characters are still blocked below.
      if (event.key.length > 1 && !isStepKey && boundaryValue === null) {
        return;
      }

      // Step from the authoritative numeric value unless the input has unsaved manual edits.
      // When the text is already synced, parsing the rounded display would collapse precision,
      // so pass no `currentValue` and let `incrementValue` fall back to the numeric state
      // (mirrors the button path).
      const currentValue = hadManualInput ? parseNumber(currentText, untrack(store.locale), untrack(store.format)) : null;

      const amount = store.getStepAmount(event);

      // Prevent insertion of text or caret from moving.
      event.preventDefault();
      event.stopPropagation();

      const commitDetails = createGenericEventDetails(REASONS.keyboard, nativeEvent);

      let changed = false;
      if (isStepKey || boundaryValue !== null) {
        store.allowInputSyncRef.current = true;
      }
      if (isStepKey) {
        // When stepping from the synced numeric state, refresh the commit ref to the current
        // value so a canceled step can't commit a stale `lastChangedValueRef` left over from an
        // earlier change (mirrors the button path).
        if (!hadManualInput) {
          store.lastChangedValueRef.current = untrack(store.value);
        }

        changed = store.incrementValue(amount, {
          direction: event.key === "ArrowUp" ? 1 : -1,
          currentValue,
          event: nativeEvent,
          reason: REASONS.keyboard,
        });
      } else if (boundaryValue !== null) {
        changed = store.setValue(boundaryValue, createChangeEventDetails(REASONS.keyboard, nativeEvent));
      }

      // `changed` is only true when `setValue` applied the change, which records the stored
      // (clamped/snapped) value, so commit that rather than the pre-validation input.
      if (changed) {
        store.onValueCommitted(store.lastChangedValueRef.current, commitDetails);
      }
    });

    chainHandler("onPaste", (event: ClipboardEvent & { currentTarget: HTMLInputElement }) => {
      if (event.defaultPrevented || untrack(readOnly) || untrack(disabled)) {
        return;
      }

      let pastedData = "";

      try {
        pastedData = event.clipboardData?.getData("text/plain") ?? "";
      } catch {
        return;
      }

      // Prevent `onInput` from being called.
      event.preventDefault();

      // Insert the pasted text at the caret/selection instead of replacing the entire value,
      // matching native input behavior (e.g. pasting "5" into "123|" yields "1235").
      const currentTarget = event.currentTarget;
      const selectionStart = currentTarget.selectionStart ?? untrack(inputValue).length;
      const selectionEnd = currentTarget.selectionEnd ?? selectionStart;
      const currentText = untrack(inputValue);
      const nextText = currentText.slice(0, selectionStart) + pastedData + currentText.slice(selectionEnd);

      const parsedValue = parseNumber(nextText, untrack(store.locale), untrack(store.format));

      if (parsedValue !== null) {
        store.allowInputSyncRef.current = false;
        pendingCaret = selectionStart + pastedData.length;
        store.setValue(parsedValue, createChangeEventDetails(REASONS.inputPaste, event));
        store.setInputValue(nextText);
      }
    });

    function chainHandler(key: string, internal: (event: any) => void) {
      const external = externalProps[key] as ((event: any) => void) | undefined;
      target[key] = (event: Event) => {
        makeEventPreventable(event as any);
        external?.(event);
        if ((event as any).rebaseUIHandlerPrevented || (event as Event).defaultPrevented) {
          return;
        }
        internal(event);
      };
    }

    return validation.getValidationProps(disabled(), target);
  };

  return (
    <RenderElement
      as={as}
      state={state}
      props={[elementProps, inputHandlers, { ref: setInputRef }]}
      stateAttributesMapping={stateAttributesMapping}
    />
  );
}

const defaultProps = Object.freeze({
  as: "input",
} satisfies Partial<NumberFieldInput.Props>);

export interface NumberFieldInputState extends NumberFieldRootState {}

export interface NumberFieldInputOwnProps {
  /**
   * A user-friendly description of the input's role for assistive tech. This is a role
   * description, not an accessible name — use `Field.Label` or `aria-label` to name the control.
   * @default 'Number field'
   */
  "aria-roledescription"?: string | undefined;
}

export type NumberFieldInputProps<T extends ValidComponent = "input"> = NumberFieldInputOwnProps &
  RebaseUIComponentProps<T, NumberFieldInputState>;

export namespace NumberFieldInput {
  export type State = NumberFieldInputState;
  export type Props<T extends ValidComponent = "input"> = NumberFieldInputProps<T>;
}
