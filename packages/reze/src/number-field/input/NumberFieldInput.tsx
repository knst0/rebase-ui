import { formatNumber } from "@rebase-ui/core/formatNumber";
import {
  ANY_MINUS_DETECT_RE,
  ANY_MINUS_RE,
  ANY_PLUS_DETECT_RE,
  ANY_PLUS_RE,
  FORMAT_CONTROL_DETECT_RE,
  getNumberLocaleDetails,
  isNumeralChar,
  parseNumber,
} from "@rebase-ui/core/parse";
import { hasNumberFormatRoundingOptions, removeFloatingPointErrors } from "@rebase-ui/core/validate";
import { dynamicElement, effect, omitProps, untrack, type JSX } from "reze-js";

import { createChangeEventDetails, createGenericEventDetails, REASONS } from "../../internals/event-details";
import { createRegisterFieldControl } from "../../internals/field-register-control";
import { createSetFieldFocused, useFieldRootContext } from "../../internals/field-root-context";
import { useFormContext } from "../../internals/form-context";
import { useLabelableContext } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import { getNumberFieldStateSnapshot, type NumberFieldRootState } from "../root/NumberFieldRoot";
import { useNumberFieldRootContext } from "../root/NumberFieldRootContext";

const NAVIGATE_KEYS = new Set(["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter", "Escape"]);

/**
 * The native input control in the number field.
 * Renders an `<input>` element.
 *
 * Documentation: [Rebase UI Number Field](https://rebase-ui.knst.dev/components/number-field)
 */
export function NumberFieldInput<T extends JSX.ElementType = "input">(props: NumberFieldInput.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "id",
    "required",
    "disabled",
    "readOnly",
    "readonly",
    "inputMode",
    "inputmode",
    "value",
    "type",
    "autoComplete",
    "autocomplete",
    "autoCorrect",
    "autocorrect",
    "spellCheck",
    "spellcheck",
    "aria-labelledby",
    "aria-roledescription",
    "aria-invalid",
    "aria-describedby",
    "onFocus",
    "onBlur",
    "onInput",
    "onChange",
    "onKeyDown",
    "onPaste",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const store = useNumberFieldRootContext();
  const { state } = store;
  const { disabled, readOnly, required, value, inputValue } = state;

  const { clearErrors } = useFormContext();
  const { validationMode, setTouched, shouldValidateOnChange, validation } = useFieldRootContext();
  const { labelId } = useLabelableContext();

  const setFocused = createSetFieldFocused(disabled, () => store.inputElement());

  let blockRevalidation = false;
  let pendingCaret: number | null = null;

  function snapshot(): NumberFieldInputState {
    return getNumberFieldStateSnapshot(state);
  }

  createRegisterFieldControl({
    controlElement: () => store.inputElement(),
    id: store.id,
    value: store.value,
    enabled: () => !disabled(),
    name: store.nameProp,
  });

  // After a paste splices text into the controlled value, the browser would otherwise drop the
  // caret at the end of the new value. Restore it just after the inserted text.
  effect(() => {
    const caretSnapshot = { text: inputValue(), element: store.inputElement() };

    untrack(() => {
      if (pendingCaret != null) {
        const caret = pendingCaret;
        pendingCaret = null;
        caretSnapshot.element?.setSelectionRange(caret, caret);
      }
    });
  });

  let previousValue = value();
  effect(() => {
    const next = value();

    untrack(() => {
      if (previousValue === next) {
        return;
      }
      previousValue = next;
      clearErrors(store.name());

      if (blockRevalidation && !shouldValidateOnChange()) {
        blockRevalidation = false;
        return;
      }

      validation.change(next);
    });
  });

  function setInputRef(element: HTMLInputElement | null): void {
    store.setInputElement(element);
  }

  const ref = mergeRefs(props.ref as ((element: HTMLInputElement | null) => void) | undefined, setInputRef);

  const externalValidationProps: Record<string, any> = {};
  Object.defineProperty(externalValidationProps, "aria-describedby", {
    enumerable: true,
    configurable: true,
    get: () => props["aria-describedby"],
  });
  const validationProps = validation.getValidationProps(disabled, externalValidationProps);

  function handleFocus(event: FocusEvent): void {
    makeEventPreventable(event as RebaseUIEvent<FocusEvent>);
    (props.onFocus as unknown as ((event: FocusEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<FocusEvent>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }

    // Read-only inputs are still focusable; only the value-changing handlers stay gated on it.
    if (event.defaultPrevented || disabled()) {
      return;
    }

    setFocused(true);
  }

  function handleBlur(event: FocusEvent): void {
    makeEventPreventable(event as RebaseUIEvent<FocusEvent>);
    (props.onBlur as unknown as ((event: FocusEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<FocusEvent>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }

    if (event.defaultPrevented || disabled()) {
      return;
    }

    setTouched(true);
    setFocused(false);

    if (readOnly()) {
      return;
    }

    const hadManualInput = !store.allowInputSyncRef.current;
    const hadPendingProgrammaticChange = store.hasPendingCommitRef.current;

    store.allowInputSyncRef.current = true;

    const currentText = inputValue();
    const currentValue = value();

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

    const formatOptions = store.format();
    const parsedValue = parseNumber(currentText, store.locale(), formatOptions);
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
    const canonicalText = formatNumber(committedValue, store.locale(), formatOptions);
    if (currentText !== canonicalText) {
      store.setInputValue(canonicalText);
    }
  }

  // Reze fires `onInput` per keystroke (where upstream React's `onChange` runs); the live
  // value logic runs here. The native `onChange` below only chains external handlers.
  function handleInputEvent(event: InputEvent): void {
    if (event.defaultPrevented) {
      return;
    }

    store.allowInputSyncRef.current = false;
    const targetValue = (event.currentTarget as HTMLInputElement).value;

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
      (event.currentTarget as HTMLInputElement).value = inputValue();
      return;
    }

    const parsedValue = parseNumber(targetValue, store.locale(), store.format());

    store.setInputValue(targetValue);

    if (parsedValue !== null) {
      store.setValue(parsedValue, createChangeEventDetails(REASONS.inputChange, event));
    }
  }

  function handleInput(event: InputEvent): void {
    makeEventPreventable(event as unknown as RebaseUIEvent<InputEvent>);
    (props.onInput as unknown as ((event: InputEvent) => void) | undefined)?.(event);
    // React's `onChange` fires per keystroke; chain it here so consumers keep that semantic.
    (props.onChange as unknown as ((event: InputEvent) => void) | undefined)?.(event);
    if ((event as unknown as RebaseUIEvent<InputEvent>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }
    handleInputEvent(event);
  }

  function handleChange(event: Event): void {
    // The input fires `onChange` on commit (blur/Enter) rather than per keystroke: it only chains
    // external handlers. Live value logic runs from `onInput` above.
    makeEventPreventable(event as RebaseUIEvent<Event>);
    (props.onChange as unknown as ((event: Event) => void) | undefined)?.(event);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    makeEventPreventable(event as RebaseUIEvent<KeyboardEvent>);
    (props.onKeyDown as unknown as ((event: KeyboardEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<KeyboardEvent>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }

    if (event.defaultPrevented || readOnly() || disabled()) {
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

    const { decimal, currency, percentSign } = getNumberLocaleDetails(store.locale(), store.format());

    const currentText = inputValue();
    const currentTarget = event.currentTarget as HTMLInputElement;
    const selectionStart = currentTarget.selectionStart;
    const selectionEnd = currentTarget.selectionEnd;
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

    const minValue = store.min();
    const maxValue = store.max();

    // Home/End jump to the corresponding bound, but only when that bound is defined.
    let boundaryValue: number | null = null;
    if (event.key === "Home" && minValue != null) {
      boundaryValue = minValue;
    } else if (event.key === "End" && maxValue != null) {
      boundaryValue = maxValue;
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
    const currentValue = hadManualInput ? parseNumber(currentText, store.locale(), store.format()) : null;

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
        store.lastChangedValueRef.current = store.value();
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
  }

  function handlePaste(event: ClipboardEvent): void {
    makeEventPreventable(event as RebaseUIEvent<ClipboardEvent>);
    (props.onPaste as unknown as ((event: ClipboardEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<ClipboardEvent>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }

    if (event.defaultPrevented || readOnly() || disabled()) {
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
    const pasteTarget = event.currentTarget as HTMLInputElement;
    const selectionStart = pasteTarget.selectionStart ?? inputValue().length;
    const selectionEnd = pasteTarget.selectionEnd ?? selectionStart;
    const currentText = inputValue();
    const nextText = currentText.slice(0, selectionStart) + pastedData + currentText.slice(selectionEnd);

    const parsedValue = parseNumber(nextText, store.locale(), store.format());

    if (parsedValue !== null) {
      store.allowInputSyncRef.current = false;
      pendingCaret = selectionStart + pastedData.length;
      store.setValue(parsedValue, createChangeEventDetails(REASONS.inputPaste, event));
      store.setInputValue(nextText);
    }
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "input");

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would drop the
  // control's value, focus, and listeners every time the error appears or disappears. The
  // default path renders a static `<input>` so validation updates patch it in place; only a
  // customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <input
        {...(rest as Record<string, unknown>)}
        id={store.id()}
        required={required()}
        bool:disabled={disabled()}
        readonly={readOnly()}
        inputmode={store.inputMode()}
        value={inputValue()}
        aria-invalid={validationProps["aria-invalid"]}
        aria-labelledby={props["aria-labelledby"] ?? labelId()}
        aria-describedby={validationProps["aria-describedby"]}
        type="text"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        aria-roledescription={props["aria-roledescription"] ?? "Number field"}
        data-disabled={disabled() ? "" : undefined}
        data-readonly={readOnly() ? "" : undefined}
        data-required={required() ? "" : undefined}
        data-scrubbing={state.scrubbing() ? "" : undefined}
        data-valid={state.valid() === true ? "" : undefined}
        data-invalid={state.valid() === false ? "" : undefined}
        data-touched={state.touched() ? "" : undefined}
        data-dirty={state.dirty() ? "" : undefined}
        data-filled={state.filled() ? "" : undefined}
        data-focused={state.focused() ? "" : undefined}
        data-validating={state.validating() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onInput={handleInput}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        ref={ref}
      >
        {resolveChildrenValue(children, snapshot)}
      </input>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={store.id()}
      required={required()}
      bool:disabled={disabled()}
      readonly={readOnly()}
      inputmode={store.inputMode()}
      value={inputValue()}
      aria-invalid={validationProps["aria-invalid"]}
      aria-labelledby={props["aria-labelledby"] ?? labelId()}
      aria-describedby={validationProps["aria-describedby"]}
      type="text"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      aria-roledescription={props["aria-roledescription"] ?? "Number field"}
      data-disabled={disabled() ? "" : undefined}
      data-readonly={readOnly() ? "" : undefined}
      data-required={required() ? "" : undefined}
      data-scrubbing={state.scrubbing() ? "" : undefined}
      data-valid={state.valid() === true ? "" : undefined}
      data-invalid={state.valid() === false ? "" : undefined}
      data-touched={state.touched() ? "" : undefined}
      data-dirty={state.dirty() ? "" : undefined}
      data-filled={state.filled() ? "" : undefined}
      data-focused={state.focused() ? "" : undefined}
      data-validating={state.validating() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onInput={handleInput}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface NumberFieldInputState extends NumberFieldRootState {}

export interface NumberFieldInputOwnProps {
  /**
   * A user-friendly description of the input's role for assistive tech. This is a role
   * description, not an accessible name — use `Field.Label` or `aria-label` to name the control.
   * @default 'Number field'
   */
  "aria-roledescription"?: string | undefined;
}

export type NumberFieldInputProps<T extends JSX.ElementType = "input"> = NumberFieldInputOwnProps &
  Pick<ButtonEventHandlers, "onKeyDown"> &
  RebaseUIComponentProps<T, NumberFieldInputState>;

export namespace NumberFieldInput {
  export type State = NumberFieldInputState;
  export type Props<T extends JSX.ElementType = "input"> = NumberFieldInputProps<T>;
}
