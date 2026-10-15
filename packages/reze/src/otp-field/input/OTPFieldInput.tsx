import { dynamicElement, effect, omitProps, store, untrack, type JSX } from "reze-js";

import { useCompositeListItem } from "../../internals/composite";
import { createChangeEventDetails, createGenericEventDetails, REASONS } from "../../internals/event-details";
import { createSetFieldFocused } from "../../internals/field-root-context";
import { stopEvent } from "../../internals/floating/utils/event";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import { platform } from "../../internals/utils/platform";
import type { RebaseUIEvent } from "../../types";
import { getOTPFieldStateSnapshot, type OTPFieldRootState } from "../root/OTPFieldRoot";
import { getOTPFieldInputState, useOTPFieldRootContext } from "../root/OTPFieldRootContext";
import { normalizeOTPValueWithDetails, removeOTPCharacter, replaceOTPValue } from "../utils/otp";

function getDirection(input: HTMLInputElement): "ltr" | "rtl" {
  const doc = input.ownerDocument;
  const dirElement = input.closest("[dir]") ?? doc?.documentElement;
  return dirElement?.getAttribute("dir") === "rtl" ? "rtl" : "ltr";
}

/**
 * An individual OTP character input.
 * Renders an `<input>` element.
 *
 * Documentation: [Rebase UI OTP Field](https://rebase-ui.knst.dev/components/otp-field)
 */
export function OTPFieldInput<T extends JSX.ElementType = "input">(props: OTPFieldInput.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "aria-label",
    "aria-labelledby",
    "id",
    "type",
    "maxlength",
    "inputmode",
    "autocomplete",
    "tabindex",
    "disabled",
    "form",
    "pattern",
    "readonly",
    "required",
    "aria-invalid",
    "value",
    "onMouseDown",
    "onFocus",
    "onBlur",
    "onInput",
    "onChange",
    "onKeyDown",
    "onPaste",
    "onCompositionStart",
    "onCompositionEnd",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const context = useOTPFieldRootContext();

  const { ref: listItemRef, index } = useCompositeListItem();
  let inputElement: HTMLInputElement | null = null;
  const setFocused = createSetFieldFocused(context.disabled, () => inputElement, context.setFocused);

  // While an IME composition is active, Safari exposes the in-progress text through `onInput`
  // as an accumulating string (`d`, then `dd`, then `ddd`). Committing those intermediate values
  // would treat them as bulk input and fill too many slots, so the text is only buffered here
  // and committed once on `compositionend`.
  // Writes flush asynchronously, but composition handlers must observe each other's updates in
  // the same tick, so the synchronous snapshot below is the source of truth in handlers and the
  // store only mirrors it for the reactive `value` prop.
  let composingSnapshot: string | null = null;
  const composingStore = store({ value: null as string | null });

  function composingValue(): string | null {
    return composingStore.value;
  }

  function setComposing(next: string | null) {
    composingSnapshot = next;
    composingStore.value = next;
  }

  function slotValue(): string {
    return context.value()[index()] ?? "";
  }

  function slotAriaLabel(): string | undefined {
    return props["aria-label"];
  }

  function inheritedLabel(): string | undefined {
    return props["aria-labelledby"] ?? context.inputAriaLabelledBy();
  }

  function ariaLabel(): string | undefined {
    return index() === 0 ? undefined : slotAriaLabel();
  }

  function snapshot(): OTPFieldInputState {
    return getOTPFieldInputState(getOTPFieldStateSnapshot(context.state), slotValue(), index());
  }

  effect(() => {
    const slotIndex = index();
    const label = slotAriaLabel();

    untrack(() => {
      if (process.env.NODE_ENV === "production") {
        return;
      }

      if (slotIndex !== 0 || label == null || inputElement?.labels?.length) {
        return;
      }

      console.error(
        "Rebase UI: <OTPField.Input> ignores `aria-label` on the first input. Use a `<label>` or `<Field.Label>` to label the OTP field.",
      );
    });
  });

  function commitValue(
    rawValue: string,
    reason: typeof REASONS.inputChange | typeof REASONS.inputPaste,
    event: Event & { currentTarget: HTMLInputElement },
  ) {
    const slotIndex = index();
    const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
      rawValue,
      context.length(),
      context.validationType(),
      context.normalizeValue(),
    );

    if (didRejectCharacters) {
      context.reportValueInvalid(rawValue, createGenericEventDetails(reason, event));
    }

    if (nextDigits === "") {
      // Typed input edits the slot in place: clear it, or restore its character when every
      // typed character was rejected. An empty or fully rejected paste changes nothing.
      if (reason === REASONS.inputChange) {
        if (rawValue === "") {
          context.setValue(removeOTPCharacter(context.value(), slotIndex), createChangeEventDetails(REASONS.inputClear, event));
        } else {
          // Restore the controlled slot value explicitly (upstream relies on a
          // re-render for this).
          if (event.currentTarget.value !== slotValue()) {
            event.currentTarget.value = slotValue();
          }
          if (slotValue() !== "") {
            event.currentTarget.select();
          }
        }
      }
      return;
    }

    const committedValue = context.setValue(
      replaceOTPValue(context.value(), slotIndex, nextDigits, context.length(), context.validationType(), context.normalizeValue()),
      createChangeEventDetails(reason, event),
    );

    if (committedValue != null) {
      const nextInput = Math.min(slotIndex + nextDigits.length, context.length() - 1);
      context.queueFocusInput(nextInput, committedValue);
    }
  }

  function handleCompositionStart(event: CompositionEvent): void {
    makeEventPreventable(event as RebaseUIEvent<CompositionEvent>);
    (props.onCompositionStart as unknown as ((event: CompositionEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<CompositionEvent>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }

    // Some Android keyboards report all text as always-composing, so Android keeps
    // committing through `onInput`.
    if (!platform.os.android) {
      setComposing(slotValue());
    }
  }

  function handleCompositionEnd(event: CompositionEvent): void {
    makeEventPreventable(event as RebaseUIEvent<CompositionEvent>);
    (props.onCompositionEnd as unknown as ((event: CompositionEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<CompositionEvent>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }

    if (composingSnapshot == null) {
      return;
    }

    setComposing(null);

    if (!context.disabled() && !context.readOnly()) {
      commitValue(
        (event.currentTarget as HTMLInputElement).value,
        REASONS.inputChange,
        event as unknown as Event & { currentTarget: HTMLInputElement },
      );
    }
  }

  function handleTextInput(event: Event): void {
    makeEventPreventable(event as RebaseUIEvent<Event>);
    (props.onInput as unknown as ((event: Event) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<Event>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }

    const target = event.currentTarget as HTMLInputElement;
    if (context.disabled() || context.readOnly()) {
      // Controlled inputs do not re-render on ignored edits, so restore the
      // slot value explicitly to match upstream's controlled reset.
      if (target.value !== slotValue()) {
        target.value = slotValue();
      }
      return;
    }

    if (composingSnapshot != null) {
      setComposing(target.value);
      return;
    }

    commitValue(target.value, REASONS.inputChange, event as Event & { currentTarget: HTMLInputElement });
  }

  function handleChange(event: Event): void {
    // The input only chains external handlers here: live value logic runs from `onInput` above.
    (props.onChange as unknown as ((event: Event) => void) | undefined)?.(event);
  }

  function setKeyboardValue(event: KeyboardEvent, nextValue: string, targetIndex: number) {
    const committedValue = context.setValue(nextValue, createChangeEventDetails(REASONS.keyboard, event));

    if (committedValue != null) {
      context.queueFocusInput(targetIndex, committedValue);
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    makeEventPreventable(event as RebaseUIEvent<KeyboardEvent>);
    (props.onKeyDown as unknown as ((event: KeyboardEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<KeyboardEvent>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }

    // Browsers deliver real key names (such as `Backspace`) for keydowns inside a composition.
    // The IME owns editing until `compositionend`, so OTP commands must not run on them.
    if (context.disabled() || composingSnapshot != null) {
      return;
    }

    const target = event.currentTarget as HTMLInputElement;
    const slotIndex = index();
    const length = context.length();
    const firstIndex = 0;
    const lastIndex = Math.max(length - 1, firstIndex);
    const endTargetIndex = Math.min(context.value().length, lastIndex);
    const hasBoundaryModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
    const isRtl = getDirection(target) === "rtl";
    const previousKey = isRtl ? "ArrowRight" : "ArrowLeft";
    const nextKey = isRtl ? "ArrowLeft" : "ArrowRight";

    if (event.key === previousKey) {
      stopEvent(event);
      context.focusInput(hasBoundaryModifier ? firstIndex : Math.max(firstIndex, slotIndex - 1));
      return;
    }

    if (event.key === nextKey) {
      stopEvent(event);
      context.focusInput(hasBoundaryModifier ? endTargetIndex : Math.min(lastIndex, slotIndex + 1));
      return;
    }

    if (event.key === "Home" || event.key === "ArrowUp") {
      stopEvent(event);
      context.focusInput(firstIndex);
      return;
    }

    if (event.key === "End" || event.key === "ArrowDown") {
      stopEvent(event);
      context.focusInput(endTargetIndex);
      return;
    }

    if (context.readOnly()) {
      return;
    }

    if (event.key === "Backspace" && hasBoundaryModifier) {
      stopEvent(event);
      setKeyboardValue(event, "", firstIndex);
      return;
    }

    if (event.key === "Delete") {
      stopEvent(event);
      setKeyboardValue(event, removeOTPCharacter(context.value(), slotIndex), slotIndex);
      return;
    }

    const inputValue = target.value;
    const fullSelection = target.selectionStart === 0 && target.selectionEnd === inputValue.length;

    if (event.key.length === 1 && fullSelection && slotValue() === event.key) {
      stopEvent(event);
      if (slotIndex < length - 1) {
        context.focusInput(slotIndex + 1);
      }
      return;
    }

    if (event.key === "Backspace") {
      stopEvent(event);
      const targetIndex = Math.max(firstIndex, slotIndex - 1);
      const deleteIndex = slotValue() === "" ? targetIndex : slotIndex;
      setKeyboardValue(event, removeOTPCharacter(context.value(), deleteIndex), targetIndex);
    }
  }

  function handlePaste(event: ClipboardEvent): void {
    makeEventPreventable(event as RebaseUIEvent<ClipboardEvent>);
    (props.onPaste as unknown as ((event: ClipboardEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<ClipboardEvent>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }

    if (context.disabled() || context.readOnly()) {
      return;
    }

    let rawValue = "";

    try {
      rawValue = event.clipboardData?.getData("text/plain") ?? "";
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.error("<OTPField.Input> could not read clipboard text during paste handling.");
      }

      return;
    }

    event.preventDefault();

    commitValue(rawValue, REASONS.inputPaste, event as unknown as Event & { currentTarget: HTMLInputElement });
  }

  function handleMouseDown(event: MouseEvent): void {
    makeEventPreventable(event as RebaseUIEvent<MouseEvent>);
    (props.onMouseDown as unknown as ((event: MouseEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<MouseEvent>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }

    if (context.disabled()) {
      return;
    }

    event.preventDefault();
    context.focusInput(index());
  }

  function handleFocus(event: FocusEvent): void {
    makeEventPreventable(event as RebaseUIEvent<FocusEvent>);
    (props.onFocus as unknown as ((event: FocusEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<FocusEvent>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }

    if (context.disabled()) {
      return;
    }

    setFocused(true);
    context.handleInputFocus(index(), event);
  }

  function handleBlur(event: FocusEvent): void {
    makeEventPreventable(event as RebaseUIEvent<FocusEvent>);
    (props.onBlur as unknown as ((event: FocusEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<FocusEvent>).rebaseUIHandlerPrevented || event.defaultPrevented) {
      return;
    }

    // Focus moving to a sibling slot stays inside the root; `handleInputBlur` clears the
    // focused state only when focus leaves the root, so slot-to-slot moves don't churn it.
    context.handleInputBlur(event);
  }

  const ref = mergeRefs(listItemRef, props.ref as ((element: HTMLElement | null) => void) | undefined, (element: HTMLElement | null) => {
    inputElement = element as HTMLInputElement | null;
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "input");

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would drop the
  // slot's value, focus, and listeners every time a sibling appears or disappears. The
  // default path renders a static `<input>` so updates patch it in place; only a
  // customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <input
        {...(rest as Record<string, unknown>)}
        id={context.getInputId(index())}
        type={(props.type as string | undefined) ?? (context.mask() ? "password" : "text")}
        inputmode={context.inputMode()}
        autocomplete={index() === 0 ? context.autoComplete() : "off"}
        autocorrect="off"
        spellcheck="false"
        enterkeyhint={index() === context.length() - 1 ? "done" : "next"}
        maxlength={(props.maxlength as number | undefined) ?? (index() === 0 ? context.length() : undefined)}
        tabindex={context.activeIndex() === index() ? 0 : -1}
        bool:disabled={context.disabled()}
        form={context.form()}
        pattern={context.pattern()}
        readonly={context.readOnly()}
        required={context.required()}
        aria-labelledby={ariaLabel() == null ? inheritedLabel() : undefined}
        aria-invalid={!context.disabled() && context.invalid() ? "true" : undefined}
        aria-label={ariaLabel()}
        value={composingValue() ?? slotValue()}
        data-complete={context.state.complete() ? "" : undefined}
        data-filled={slotValue() !== "" ? "" : undefined}
        data-disabled={context.disabled() ? "" : undefined}
        data-readonly={context.readOnly() ? "" : undefined}
        data-required={context.required() ? "" : undefined}
        data-valid={context.state.valid() === true ? "" : undefined}
        data-invalid={context.state.valid() === false ? "" : undefined}
        data-touched={context.state.touched() ? "" : undefined}
        data-dirty={context.state.dirty() ? "" : undefined}
        data-focused={context.state.focused() ? "" : undefined}
        data-validating={context.state.validating() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onMouseDown={handleMouseDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onInput={handleTextInput}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        ref={ref}
      >
        {resolveChildrenValue(children, snapshot)}
      </input>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={context.getInputId(index())}
      type={(props.type as string | undefined) ?? (context.mask() ? "password" : "text")}
      inputmode={context.inputMode()}
      autocomplete={index() === 0 ? context.autoComplete() : "off"}
      autocorrect="off"
      spellcheck="false"
      enterkeyhint={index() === context.length() - 1 ? "done" : "next"}
      maxlength={(props.maxlength as number | undefined) ?? (index() === 0 ? context.length() : undefined)}
      tabindex={context.activeIndex() === index() ? 0 : -1}
      bool:disabled={context.disabled()}
      form={context.form()}
      pattern={context.pattern()}
      readonly={context.readOnly()}
      required={context.required()}
      aria-labelledby={ariaLabel() == null ? inheritedLabel() : undefined}
      aria-invalid={!context.disabled() && context.invalid() ? "true" : undefined}
      aria-label={ariaLabel()}
      value={composingValue() ?? slotValue()}
      data-complete={context.state.complete() ? "" : undefined}
      data-filled={slotValue() !== "" ? "" : undefined}
      data-disabled={context.disabled() ? "" : undefined}
      data-readonly={context.readOnly() ? "" : undefined}
      data-required={context.required() ? "" : undefined}
      data-valid={context.state.valid() === true ? "" : undefined}
      data-invalid={context.state.valid() === false ? "" : undefined}
      data-touched={context.state.touched() ? "" : undefined}
      data-dirty={context.state.dirty() ? "" : undefined}
      data-focused={context.state.focused() ? "" : undefined}
      data-validating={context.state.validating() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onMouseDown={handleMouseDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onInput={handleTextInput}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface OTPFieldInputState extends Omit<OTPFieldRootState, "filled" | "value"> {
  /**
   * Whether this input contains a character.
   */
  filled: boolean;
  /**
   * The input index.
   */
  index: number;
  /**
   * The character rendered in this slot.
   */
  value: string;
}

export type OTPFieldInputProps<T extends JSX.ElementType = "input"> = RebaseUIComponentProps<T, OTPFieldInputState>;

export namespace OTPFieldInput {
  export type State = OTPFieldInputState;
  export type Props<T extends JSX.ElementType = "input"> = OTPFieldInputProps<T>;
}
