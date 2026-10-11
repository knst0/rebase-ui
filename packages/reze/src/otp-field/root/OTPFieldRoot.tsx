import { dynamicElement, effect, getOwner, omitProps, onCleanup, runWithOwner, store, untrack, type JSX } from "reze-js";

import type { FieldRootState } from "../../field/root/FieldRoot";
import { CompositeListContext, createCompositeList } from "../../internals/composite";
import { createControllableSignal } from "../../internals/createControllableSignal";
import {
  createChangeEventDetails,
  createGenericEventDetails,
  REASONS,
  type RebaseUIChangeEventDetails,
  type RebaseUIGenericEventDetails,
} from "../../internals/event-details";
import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { createRegisterFieldControl } from "../../internals/field-register-control";
import { useFieldRootContext } from "../../internals/field-root-context";
import { useFormContext } from "../../internals/form-context";
import { createAriaLabelledBy, createLabelableId, useLabelableContext } from "../../internals/labelable-provider";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument } from "../../internals/utils/owner";
import { visuallyHidden, visuallyHiddenInput } from "../../internals/utils/visuallyHidden";
import { getOTPValidationConfig, normalizeOTPValue, normalizeOTPValueWithDetails, type OTPValidationType } from "../utils/otp";
import { OTPFieldRootContext, useOTPFieldRootContext } from "./OTPFieldRootContext";

/**
 * Groups all OTP field parts and manages their state.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI OTP Field](https://rebase-ui.knst.dev/components/otp-field)
 */
export function OTPFieldRoot<T extends JSX.ElementType = "div">(props: OTPFieldRoot.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "aria-describedby",
    "aria-labelledby",
    "id",
    "autoComplete",
    "defaultValue",
    "value",
    "onValueChange",
    "onValueComplete",
    "form",
    "length",
    "autoSubmit",
    "mask",
    "inputMode",
    "validationType",
    "normalizeValue",
    "disabled",
    "readOnly",
    "required",
    "name",
    "onValueInvalid",
    "class",
    "style",
    "children",
    "ref",
  );
  const autoSubmit = props.autoSubmit ?? false;

  const field = useFieldRootContext();
  const { clearErrors } = useFormContext();
  const { getDescriptionProps, labelId } = useLabelableContext();

  function disabled(): boolean {
    return field.disabled() === true || props.disabled === true;
  }

  function name(): string | undefined {
    return field.name() ?? props.name;
  }

  const [valueUnwrapped, setValueUnwrapped] = createControllableSignal<string>({
    value: () => props.value,
    defaultValue: () => props.defaultValue ?? "",
  });

  const compositeList = createCompositeList();

  function inputElements(): HTMLInputElement[] {
    return compositeList.elements() as HTMLInputElement[];
  }

  let rootElement: HTMLElement | null = null;
  let pendingFocus: { index: number; value: string } | null = null;
  let pendingCompleteValue: {
    value: string;
    eventDetails: OTPFieldRoot.CompleteEventDetails;
  } | null = null;

  const id = createLabelableId({ id: () => props.id });

  function firstInput(): HTMLInputElement | null {
    return inputElements()[0] ?? null;
  }

  // The outer `Omit` over the generic element props is not string-indexable,
  // so the merged aria props are read through this internal view.
  const ariaProps = props as unknown as Record<"aria-labelledby" | "aria-describedby", string | undefined>;

  const ariaLabelledBy = createAriaLabelledBy({
    ariaLabelledBy: () => ariaProps["aria-labelledby"],
    labelId,
    labelSource: firstInput,
    enableFallback: () => true,
    labelSourceId: id,
  });

  function inputAriaLabelledBy(): string | undefined {
    return ariaProps["aria-labelledby"] == null ? ariaLabelledBy() : undefined;
  }

  function ariaDescribedBy(): string | undefined {
    return mergeAriaIds(ariaProps["aria-describedby"], getDescriptionProps({})["aria-describedby"]);
  }

  function validationType(): OTPFieldRoot.ValidationType {
    return props.validationType ?? "numeric";
  }

  function validationConfig() {
    return getOTPValidationConfig(validationType());
  }

  function pattern(): string | undefined {
    return validationConfig()?.slotPattern;
  }

  function hiddenInputPattern(): string | undefined {
    return validationConfig()?.getRootPattern(props.length);
  }

  function inputMode(): OTPFieldInputMode | undefined {
    return props.inputMode ?? validationConfig()?.inputMode;
  }

  function hasValidLength(): boolean {
    return Number.isInteger(props.length) && props.length > 0;
  }

  function value(): string {
    return normalizeOTPValue(valueUnwrapped(), props.length, validationType(), props.normalizeValue);
  }

  // The controllable signal flushes asynchronously, so event handlers and the
  // value-change effect below read this synchronous snapshot instead, mirroring
  // upstream's `valueRef`.
  let valueSnapshot: string = value();

  function filled(): boolean {
    return value() !== "";
  }

  function complete(): boolean {
    return value().length === props.length;
  }

  function readOnly(): boolean {
    return props.readOnly ?? false;
  }

  function required(): boolean {
    return props.required ?? false;
  }

  const focusState = store({
    index: Math.min(valueSnapshot.length, props.length - 1),
    focused: false,
  });

  function focusedIndex(): number {
    return focusState.index;
  }

  function focused(): boolean {
    return focusState.focused;
  }

  function setFocusedIndex(next: number): void {
    focusState.index = next;
  }

  function setFocusedState(next: boolean): void {
    focusState.focused = next;
  }

  function activeIndex(): number {
    const length = props.length;
    if (focused()) {
      return Math.min(focusedIndex(), Math.max(length - 1, 0));
    }
    return Math.min(value().length, length - 1);
  }

  effect(() => {
    const isFilled = filled();

    // Actions never subscribe: the fill sync below only writes, so the effect
    // tracks just the filled state above.
    untrack(() => {
      field.setFilled(isFilled);
    });
  });

  effect(() => {
    const count = compositeList.map().size;
    const otpLength = props.length;

    untrack(() => {
      if (process.env.NODE_ENV === "production") {
        return;
      }

      if (!Number.isInteger(otpLength) || otpLength <= 0) {
        console.error(`Rebase UI: <OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(otpLength)}}\`.`);
        return;
      }

      if (count !== 0 && count !== otpLength) {
        console.error(
          `<OTPField.Root> \`length\` must match the number of rendered \`OTPField.Input\` parts. Received \`length={${otpLength}}\` but rendered ${count} input${count === 1 ? "" : "s"}.`,
        );
      }
    });
  });

  createRegisterFieldControl({
    controlElement: firstInput,
    id,
    value,
    enabled: () => !disabled(),
    name: () => props.name,
  });

  function focusInput(index: number) {
    // Plain DOM query: this also runs from the value-change effect's deferred
    // focus, where reactive reads would warn.
    const inputs = rootElement?.querySelectorAll("input");
    if (!inputs || inputs.length === 0) {
      return;
    }
    const target = inputs[Math.min(Math.max(index, 0), inputs.length - 1)] as HTMLInputElement | undefined;
    target?.focus();
    target?.select();
  }

  function queueFocusInput(index: number, nextValue: string) {
    pendingFocus = { index, value: nextValue };
  }

  function requestSubmit() {
    // The hidden validation input only renders for a valid `length`, but the slots always do,
    // so fall back to the owning form of the first slot. Plain DOM query: this
    // also runs from the value-change effect's deferred completion.
    const firstSlot = rootElement?.querySelector("input");
    let formElement = field.validation.inputElement?.form ?? firstSlot?.form ?? null;

    const formId = props.form;
    if (formId) {
      const associatedElement = ownerDocument(rootElement).getElementById(formId);
      if (associatedElement?.tagName === "FORM") {
        formElement = associatedElement as HTMLFormElement;
      }
    }

    if (formElement && typeof formElement.requestSubmit === "function") {
      formElement.requestSubmit();
    }
  }

  function completeValue(completedValue: string, eventDetails: OTPFieldRoot.CompleteEventDetails) {
    props.onValueComplete?.(completedValue, eventDetails);

    if (autoSubmit) {
      requestSubmit();
    }
  }

  let valueChangeInitialized = false;
  effect(() => {
    const nextValue = value();
    const fieldName = name();
    const initialValue = field.validityData.initialValue;

    // Actions never subscribe: the change handling below only writes and calls
    // one-shot handlers, so the effect tracks just the value, name, and initial value above.
    untrack(() => {
      if (!valueChangeInitialized) {
        valueChangeInitialized = true;
        valueSnapshot = nextValue;
        return;
      }

      valueSnapshot = nextValue;
      clearErrors(fieldName);
      field.setDirty(nextValue !== initialValue);
      field.validation.change(nextValue);

      const pendingFocusValue = pendingFocus;
      if (pendingFocusValue != null) {
        pendingFocus = null;

        if (pendingFocusValue.value === nextValue) {
          // Defer past the effect: focusing dispatches focus/blur events
          // synchronously, and handlers reading reactive values inside this
          // effect would warn. The value guard drops focuses superseded by a
          // newer change.
          const targetIndex = pendingFocusValue.index;
          const expectedValue = pendingFocusValue.value;
          queueMicrotask(() => {
            if (valueSnapshot === expectedValue) {
              focusInput(targetIndex);
            }
          });
        }
      }

      const pendingComplete = pendingCompleteValue;
      if (pendingComplete != null) {
        pendingCompleteValue = null;

        if (pendingComplete.value === nextValue) {
          completeValue(nextValue, pendingComplete.eventDetails);
        }
      }
    });
  });

  function setValue(nextValue: string, details: OTPFieldRoot.ChangeEventDetails): string | null {
    const length = props.length;
    const normalizedValue = normalizeOTPValue(nextValue, length, validationType(), props.normalizeValue);
    const canComplete = details.reason === REASONS.inputChange || details.reason === REASONS.inputPaste;
    const completeEventDetails =
      canComplete && normalizedValue.length === length && (valueSnapshot.length !== length || details.reason === REASONS.inputPaste)
        ? createGenericEventDetails(details.reason, details.event)
        : null;

    if (normalizedValue === valueSnapshot) {
      if (completeEventDetails != null) {
        completeValue(normalizedValue, completeEventDetails);
      }

      return null;
    }

    props.onValueChange?.(normalizedValue, details);

    if (details.isCanceled) {
      return null;
    }

    setValueUnwrapped(normalizedValue);
    valueSnapshot = normalizedValue;
    if (completeEventDetails != null) {
      pendingCompleteValue = {
        value: normalizedValue,
        eventDetails: completeEventDetails,
      };
    } else if (normalizedValue.length !== length) {
      pendingCompleteValue = null;
    }

    return normalizedValue;
  }

  function reportValueInvalid(invalidValue: string, details: OTPFieldRoot.InvalidEventDetails) {
    props.onValueInvalid?.(invalidValue, details);
  }

  function handleInputFocus(index: number, event: FocusEvent) {
    if (index > valueSnapshot.length) {
      focusInput(Math.min(valueSnapshot.length, props.length - 1));
      return;
    }

    setFocusedIndex(index);
    (event.currentTarget as HTMLInputElement).select();
  }

  function handleInputBlur(event: FocusEvent) {
    const relatedTarget = event.relatedTarget as Element | null;
    if (relatedTarget && rootElement?.contains(relatedTarget)) {
      return;
    }

    field.setTouched(true);
    setFocusedState(false);
    field.setFocused(false);

    if (field.validationMode === "onBlur") {
      void field.validation.commit(valueSnapshot);
    }
  }

  function getInputId(index: number) {
    const baseId = id();
    if (baseId == null) {
      return undefined;
    }

    return index === 0 ? baseId : `${baseId}-${index + 1}`;
  }

  const state: OTPFieldRootStateSelectors = {
    ...field.state,
    complete,
    disabled,
    filled,
    focused,
    length: () => props.length,
    readOnly,
    required,
    value,
  };

  const contextValue: OTPFieldRootContext = {
    activeIndex,
    autoComplete: () => props.autoComplete ?? "one-time-code",
    disabled,
    form: () => props.form,
    focusInput,
    queueFocusInput,
    getInputId,
    handleInputBlur,
    handleInputFocus,
    inputMode,
    inputAriaLabelledBy,
    invalid: field.invalid,
    length: () => props.length,
    mask: () => props.mask ?? false,
    pattern,
    reportValueInvalid,
    readOnly,
    required,
    normalizeValue: () => props.normalizeValue,
    setFocused: setFocusedState,
    setValue,
    state,
    validationType,
    value,
  };

  function snapshot(): OTPFieldRootState {
    return getOTPFieldStateSnapshot(state);
  }

  const ref = mergeRefs(props.ref as ((element: HTMLElement | null) => void) | undefined, (element: HTMLElement | null) => {
    rootElement = element;
  });

  onCleanup(() => {
    rootElement = null;
  });

  const hiddenValidationProps = field.validation.getValidationProps(disabled, {});

  function handleHiddenFocus() {
    focusInput(0);
  }

  function handleHiddenInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    if (event.defaultPrevented || disabled() || props.readOnly === true) {
      return;
    }

    const rawValue = target.value;
    const [normalizedValue, didRejectCharacters] = normalizeOTPValueWithDetails(
      rawValue,
      props.length,
      validationType(),
      props.normalizeValue,
    );

    if (didRejectCharacters) {
      reportValueInvalid(rawValue, createGenericEventDetails(REASONS.inputChange, event));
    }

    const committedValue = setValue(normalizedValue, createChangeEventDetails(REASONS.inputChange, event));

    if (committedValue != null && committedValue !== "") {
      queueFocusInput(committedValue.length - 1, committedValue);
    }
  }

  function renderHiddenInput(): JSX.Element {
    return (
      <input
        ref={(element) => {
          field.validation.inputElement = element as HTMLInputElement | null;
        }}
        type="text"
        id={name() == null ? `${id()}-hidden-input` : undefined}
        form={props.form}
        name={name()}
        value={value()}
        autocomplete={props.autoComplete ?? "one-time-code"}
        inputmode={inputMode()}
        minlength={props.length}
        maxlength={props.length}
        pattern={hiddenInputPattern()}
        bool:disabled={disabled()}
        readonly={readOnly()}
        required={required()}
        aria-hidden="true"
        tabindex={-1}
        aria-invalid={hiddenValidationProps["aria-invalid"]}
        aria-describedby={hiddenValidationProps["aria-describedby"]}
        style={name() ? visuallyHiddenInput : visuallyHidden}
        onFocus={handleHiddenFocus}
        onInput={handleHiddenInput}
      />
    );
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would drop the
  // root's value, focus, and listeners every time the hidden validation input appears or
  // disappears. The default path renders a static `<div>` so updates patch it in place; only a
  // customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <>
        <div
          {...(rest as Record<string, unknown>)}
          role="group"
          aria-describedby={ariaDescribedBy()}
          aria-labelledby={ariaLabelledBy()}
          data-complete={complete() ? "" : undefined}
          data-disabled={disabled() ? "" : undefined}
          data-readonly={readOnly() ? "" : undefined}
          data-required={required() ? "" : undefined}
          data-valid={state.valid() === true ? "" : undefined}
          data-invalid={state.valid() === false ? "" : undefined}
          data-touched={state.touched() ? "" : undefined}
          data-dirty={state.dirty() ? "" : undefined}
          data-filled={state.filled() ? "" : undefined}
          data-focused={state.focused() ? "" : undefined}
          data-validating={state.validating() ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          ref={ref}
        >
          <CompositeListContext value={compositeList.contextValue}>
            <OTPFieldRootContext value={contextValue}>
              <OTPFieldRootContent>{props.children}</OTPFieldRootContent>
            </OTPFieldRootContext>
          </CompositeListContext>
        </div>
        {hasValidLength() && renderHiddenInput()}
      </>
    );
  }

  return (
    <>
      <Tag
        {...(rest as Record<string, unknown>)}
        role="group"
        aria-describedby={ariaDescribedBy()}
        aria-labelledby={ariaLabelledBy()}
        data-complete={complete() ? "" : undefined}
        data-disabled={disabled() ? "" : undefined}
        data-readonly={readOnly() ? "" : undefined}
        data-required={required() ? "" : undefined}
        data-valid={state.valid() === true ? "" : undefined}
        data-invalid={state.valid() === false ? "" : undefined}
        data-touched={state.touched() ? "" : undefined}
        data-dirty={state.dirty() ? "" : undefined}
        data-filled={state.filled() ? "" : undefined}
        data-focused={state.focused() ? "" : undefined}
        data-validating={state.validating() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={ref}
      >
        <CompositeListContext value={compositeList.contextValue}>
          <OTPFieldRootContext value={contextValue}>
            <OTPFieldRootContent>{props.children}</OTPFieldRootContent>
          </OTPFieldRootContext>
        </CompositeListContext>
      </Tag>
      {hasValidLength() && renderHiddenInput()}
    </>
  );
}

/**
 * Resolves the root children inside the OTP field contexts. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the state changes, matching the Solid layer where the children
 * memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function OTPFieldRootContent(props: { children: ChildrenValue<OTPFieldRootState> }) {
  const children = props.children;

  const { state } = useOTPFieldRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: OTPFieldRootState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the OTP field contexts (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot = getOTPFieldStateSnapshot(state);

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface OTPFieldRootState extends FieldRootState {
  /**
   * Whether all slots are filled.
   */
  complete: boolean;
  /**
   * The number of OTP input slots.
   */
  length: number;
  /**
   * Whether the user should be unable to change the field value.
   */
  readOnly: boolean;
  /**
   * Whether the user must enter a value before submitting a form.
   */
  required: boolean;
  /**
   * The OTP value.
   */
  value: string;
}

/**
 * Selector record behind the OTP field state snapshot. Parts spread the root
 * selectors and override per-slot values, then resolve a snapshot per binding.
 */
export interface OTPFieldRootStateSelectors extends FieldRootStateSelectors {
  complete: () => boolean;
  length: () => number;
  readOnly: () => boolean;
  required: () => boolean;
  value: () => string;
}

/**
 * Resolves a plain state snapshot from the selectors. Called inside JSX
 * bindings (and the state thunk passed to render functions) so each read
 * subscribes the binding to the selector it came from.
 */
export function getOTPFieldStateSnapshot(state: OTPFieldRootStateSelectors): OTPFieldRootState {
  return {
    ...getFieldStateSnapshot(state),
    complete: state.complete(),
    length: state.length(),
    readOnly: state.readOnly(),
    required: state.required(),
    value: state.value(),
  };
}

export interface OTPFieldRootOwnProps {
  /**
   * The id of the first input element.
   * Subsequent inputs derive their ids from it (`{id}-2`, `{id}-3`, and so on).
   */
  id?: string | undefined;
  /**
   * The input autocomplete attribute. Applied to the first slot and hidden validation input.
   * @default 'one-time-code'
   */
  autoComplete?: string | undefined;
  /**
   * A string specifying the `form` element with which the hidden input is associated.
   * This string's value must match the id of a `form` element in the same document.
   */
  form?: string | undefined;
  /**
   * The number of OTP input slots.
   * Required so the root can clamp values, detect completion, and generate
   * consistent validation markup before all slots hydrate.
   */
  length: number;
  /**
   * Whether to submit the owning form when the OTP becomes complete.
   * @default false
   */
  autoSubmit?: boolean | undefined;
  /**
   * Whether the slot inputs should mask entered characters.
   * Pass `type` directly to individual `<OTPField.Input>` parts to use a custom
   * input type.
   * @default false
   */
  mask?: boolean | undefined;
  /**
   * The virtual keyboard hint applied to the slot inputs and hidden validation input.
   *
   * Built-in validation modes provide sensible defaults, but you can override them when needed.
   */
  inputMode?: OTPFieldInputMode | undefined;
  /**
   * The type of input validation to apply to the OTP value.
   * @default 'numeric'
   */
  validationType?: OTPFieldRoot.ValidationType | undefined;
  /**
   * Function that normalizes the OTP value after whitespace and `validationType` filtering.
   * It runs whenever OTP Field normalizes a value, including initial/default values, controlled
   * values, and user edits.
   *
   * The returned value is filtered by `validationType` again, then clamped to `length`.
   * It should be idempotent because OTP Field may normalize the same value more than once while
   * handling edits, storing state, and rendering controlled or uncontrolled values. Non-idempotent
   * normalizers can compound across those normalization passes. Characters rejected while
   * normalizing typed or pasted text are reported through `onValueInvalid`.
   */
  normalizeValue?: ((value: string) => string) | undefined;
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
   * The OTP value.
   */
  value?: string | undefined;
  /**
   * The uncontrolled OTP value when the component is initially rendered.
   */
  defaultValue?: string | undefined;
  /**
   * Callback fired when the OTP value changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   * - `'input-change'` for typing or autofill
   * - `'input-clear'` when a character is removed by text input
   * - `'input-paste'` for paste interactions
   * - `'keyboard'` for keyboard interactions that change the value
   */
  onValueChange?: ((value: string, eventDetails: OTPFieldRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Callback fired when entered text contains characters that are rejected by validation or
   * normalization before the OTP value updates.
   *
   * The `value` argument is the attempted user-entered string before normalization.
   */
  onValueInvalid?: ((value: string, eventDetails: OTPFieldRoot.InvalidEventDetails) => void) | undefined;
  /**
   * Callback function that is fired when the OTP value becomes complete, or when a complete value
   * is pasted while the OTP is already complete.
   *
   * When the value changes, it runs later than `onValueChange`, after the internal value update is
   * applied. If a complete pasted value matches the current value, `onValueChange` does not fire.
   *
   * If `autoSubmit` is enabled, it runs immediately before the owning form is submitted.
   */
  onValueComplete?: ((value: string, eventDetails: OTPFieldRoot.CompleteEventDetails) => void) | undefined;
}

export type OTPFieldRootProps<T extends JSX.ElementType = "div"> = OTPFieldRootOwnProps &
  Omit<RebaseUIComponentProps<T, OTPFieldRootState>, "onChange">;

export type OTPFieldInputMode = "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";

export type OTPFieldRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.inputPaste
  | typeof REASONS.keyboard;
export type OTPFieldRootChangeEventDetails = RebaseUIChangeEventDetails<OTPFieldRoot.ChangeEventReason>;

export type OTPFieldRootInvalidEventReason = typeof REASONS.inputChange | typeof REASONS.inputPaste;
export type OTPFieldRootInvalidEventDetails = RebaseUIGenericEventDetails<OTPFieldRoot.InvalidEventReason>;

export type OTPFieldRootCompleteEventReason = typeof REASONS.inputChange | typeof REASONS.inputPaste;
export type OTPFieldRootCompleteEventDetails = RebaseUIGenericEventDetails<OTPFieldRoot.CompleteEventReason>;

export namespace OTPFieldRoot {
  export type State = OTPFieldRootState;
  export type Props<T extends JSX.ElementType = "div"> = OTPFieldRootProps<T>;
  export type OwnProps = OTPFieldRootOwnProps;
  export type InputMode = OTPFieldInputMode;
  export type ValidationType = OTPValidationType;
  export type ChangeEventReason = OTPFieldRootChangeEventReason;
  export type ChangeEventDetails = OTPFieldRootChangeEventDetails;
  export type InvalidEventReason = OTPFieldRootInvalidEventReason;
  export type InvalidEventDetails = OTPFieldRootInvalidEventDetails;
  export type CompleteEventReason = OTPFieldRootCompleteEventReason;
  export type CompleteEventDetails = OTPFieldRootCompleteEventDetails;
}

function mergeAriaIds(...values: Array<string | undefined>) {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? Array.from(new Set(ids)).join(" ") : undefined;
}
