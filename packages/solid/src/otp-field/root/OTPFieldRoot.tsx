import type { ValidComponent } from '@solidjs/web';
import { createEffect, createMemo, createSignal, onCleanup, Show, untrack } from 'solid-js';

import type { FieldRootState } from '../../field/root/FieldRoot';
import { CompositeListContext } from '../../internals/composite/list/CompositeListContext';
import { createCompositeList } from '../../internals/composite/list/createCompositeList';
import { createControllableSignal } from '../../internals/createControllableSignal';
import {
  createChangeEventDetails,
  createGenericEventDetails,
  REASONS,
  type RebaseUIChangeEventDetails,
  type RebaseUIGenericEventDetails,
} from '../../internals/event-details';
import { useFieldRootContext } from '../../internals/field-root-context';
import { createRegisterFieldControl } from '../../internals/field-register-control';
import { useFormContext } from '../../internals/form-context';
import {
  createAriaLabelledBy,
  createLabelableId,
  useLabelableContext,
} from '../../internals/labelable-provider';
import { RenderElement } from '../../internals/render-element';
import { split } from '../../internals/split';
import type { RebaseUIComponentProps } from '../../internals/types';
import { ownerDocument } from '../../internals/utils/owner';
import { visuallyHidden, visuallyHiddenInput } from '../../internals/utils/visuallyHidden';
import {
  getOTPValidationConfig,
  normalizeOTPValue,
  normalizeOTPValueWithDetails,
  type OTPValidationType,
} from '../utils/otp';
import { rootStateAttributesMapping } from '../utils/stateAttributesMapping';
import { OTPFieldRootContext } from './OTPFieldRootContext';

/**
 * Groups all OTP field parts and manages their state.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI OTP Field](https://rebase-ui.knst.dev/components/otp-field)
 */
export function OTPFieldRoot<T extends ValidComponent = 'div'>(props: OTPFieldRoot.Props<T>) {
  const [local, elementProps] = split(props as OTPFieldRoot.Props, { default: defaultProps }, [
    'as',
    'aria-describedby',
    'aria-labelledby',
    'id',
    'autoComplete',
    'defaultValue',
    'value',
    'onValueChange',
    'onValueComplete',
    'form',
    'length',
    'autoSubmit',
    'mask',
    'inputMode',
    'validationType',
    'normalizeValue',
    'disabled',
    'readOnly',
    'required',
    'name',
    'onValueInvalid',
  ]);

  const as = untrack(() => local.as);
  const autoSubmit = untrack(() => local.autoSubmit);

  const field = useFieldRootContext();
  const { clearErrors } = useFormContext();
  const { getDescriptionProps, labelId } = useLabelableContext();

  const disabled = createMemo(() => field.disabled() === true || local.disabled === true);
  const name = () => field.name() ?? local.name;

  const [valueUnwrapped, setValueUnwrapped] = createControllableSignal({
    value: () => local.value as string | undefined,
    defaultValue: () => local.defaultValue as string | undefined,
  });

  const compositeList = createCompositeList();
  const inputElements = createMemo(() => compositeList.elements() as HTMLInputElement[]);

  let rootElement: HTMLDivElement | null = null;
  let pendingFocus: { index: number; value: string } | null = null;
  let pendingCompleteValue: {
    value: string;
    eventDetails: OTPFieldRoot.CompleteEventDetails;
  } | null = null;

  const id = createLabelableId({ id: () => local.id });
  const firstInput = () => inputElements()[0] ?? null;
  const ariaLabelledBy = createAriaLabelledBy({
    ariaLabelledBy: () => local['aria-labelledby'] as string | undefined,
    labelId,
    labelSource: firstInput,
    enableFallback: () => true,
    labelSourceId: id,
  });
  const inputAriaLabelledBy = createMemo(() =>
    local['aria-labelledby'] == null ? ariaLabelledBy() : undefined,
  );
  const ariaDescribedBy = createMemo(() =>
    mergeAriaIds(
      local['aria-describedby'] as string | undefined,
      getDescriptionProps({})['aria-describedby'],
    ),
  );

  const validationConfig = createMemo(() => getOTPValidationConfig(local.validationType));
  const pattern = createMemo(() => validationConfig()?.slotPattern);
  const hiddenInputPattern = createMemo(() => validationConfig()?.getRootPattern(local.length));
  const inputMode = createMemo(() => local.inputMode ?? validationConfig()?.inputMode);
  const hasValidLength = createMemo(() => Number.isInteger(local.length) && local.length > 0);

  const value = createMemo(() =>
    normalizeOTPValue(valueUnwrapped(), local.length, local.validationType, local.normalizeValue),
  );
  // The controllable signal flushes asynchronously, so event handlers and the
  // value-change effect below read this synchronous snapshot instead, mirroring
  // upstream's `valueRef`.
  let valueSnapshot: string = untrack(() => value());
  const filled = createMemo(() => value() !== '');

  const [focusedIndex, setFocusedIndex] = createSignal(
    untrack(() => Math.min(value().length, local.length - 1)),
  );
  const [focused, setFocusedState] = createSignal(false);

  const activeIndex = createMemo(() => {
    const length = local.length;
    if (focused()) {
      return Math.min(focusedIndex(), Math.max(length - 1, 0));
    }
    return Math.min(value().length, length - 1);
  });

  createEffect(
    () => filled(),
    (isFilled) => {
      field.setFilled(isFilled);
    },
  );

  createEffect(
    () => ({ count: compositeList.map().size, otpLength: local.length }),
    ({ count, otpLength }) => {
      if (process.env.NODE_ENV === 'production') {
        return;
      }

      if (!Number.isInteger(otpLength) || otpLength <= 0) {
        console.error(
          `Rebase UI: <OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(otpLength)}}\`.`,
        );
        return;
      }

      if (count !== 0 && count !== otpLength) {
        console.error(
          `<OTPField.Root> \`length\` must match the number of rendered \`OTPField.Input\` parts. Received \`length={${otpLength}}\` but rendered ${count} input${count === 1 ? '' : 's'}.`,
        );
      }
    },
  );

  createRegisterFieldControl({
    controlElement: firstInput,
    id,
    value,
    enabled: () => !disabled(),
    name: () => local.name,
  });

  function focusInput(index: number) {
    // Plain DOM query: this also runs from the value-change effect's apply
    // callback, where reactive reads would warn.
    const inputs = rootElement?.querySelectorAll('input');
    if (!inputs || inputs.length === 0) {
      return;
    }
    const target = inputs[Math.min(Math.max(index, 0), inputs.length - 1)] as
      | HTMLInputElement
      | undefined;
    target?.focus();
    target?.select();
  }

  function queueFocusInput(index: number, nextValue: string) {
    pendingFocus = { index, value: nextValue };
  }

  function requestSubmit() {
    // The hidden validation input only renders for a valid `length`, but the slots always do,
    // so fall back to the owning form of the first slot. Plain DOM query: this
    // also runs from the value-change effect's apply callback.
    const firstSlot = rootElement?.querySelector('input');
    let formElement = field.validation.inputElement?.form ?? firstSlot?.form ?? null;

    const formId = untrack(() => local.form);
    if (formId) {
      const associatedElement = ownerDocument(rootElement).getElementById(formId);
      if (associatedElement?.tagName === 'FORM') {
        formElement = associatedElement as HTMLFormElement;
      }
    }

    if (formElement && typeof formElement.requestSubmit === 'function') {
      formElement.requestSubmit();
    }
  }

  function completeValue(completedValue: string, eventDetails: OTPFieldRoot.CompleteEventDetails) {
    local.onValueComplete?.(completedValue, eventDetails);

    if (autoSubmit) {
      requestSubmit();
    }
  }

  let valueChangeInitialized = false;
  createEffect(
    // The apply callback is untracked, so every reactive value it needs must
    // be read in this compute function.
    () => ({
      nextValue: value(),
      fieldName: name(),
      initialValue: field.validityData.initialValue,
    }),
    ({ nextValue, fieldName, initialValue }) => {
      if (!valueChangeInitialized) {
        valueChangeInitialized = true;
        valueSnapshot = nextValue;
        return;
      }

      valueSnapshot = nextValue;
      // One-shot invocations; reactive reads nested inside (field validity
      // lookups, handler props) are point-in-time decisions.
      untrack(() => {
        clearErrors(fieldName);
        field.setDirty(nextValue !== initialValue);

        field.validation.change(nextValue);
      });

      const pendingFocusValue = pendingFocus;
      if (pendingFocusValue != null) {
        pendingFocus = null;

        if (pendingFocusValue.value === nextValue) {
          // Defer past the effect: focusing dispatches focus/blur events
          // synchronously, and handlers reading reactive values inside this
          // apply would warn. The value guard drops focuses superseded by a
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
          untrack(() => {
            completeValue(nextValue, pendingComplete.eventDetails);
          });
        }
      }
    },
  );

  function setValue(nextValue: string, details: OTPFieldRoot.ChangeEventDetails): string | null {
    const length = local.length;
    const normalizedValue = normalizeOTPValue(
      nextValue,
      length,
      local.validationType,
      local.normalizeValue,
    );
    const canComplete =
      details.reason === REASONS.inputChange || details.reason === REASONS.inputPaste;
    const completeEventDetails =
      canComplete &&
      normalizedValue.length === length &&
      (valueSnapshot.length !== length || details.reason === REASONS.inputPaste)
        ? createGenericEventDetails(details.reason, details.event)
        : null;

    if (normalizedValue === valueSnapshot) {
      if (completeEventDetails != null) {
        completeValue(normalizedValue, completeEventDetails);
      }

      return null;
    }

    local.onValueChange?.(normalizedValue, details);

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
    local.onValueInvalid?.(invalidValue, details);
  }

  function handleInputFocus(index: number, event: FocusEvent & { currentTarget: HTMLInputElement }) {
    if (index > valueSnapshot.length) {
      focusInput(Math.min(valueSnapshot.length, local.length - 1));
      return;
    }

    setFocusedIndex(index);
    setFocusedState(true);
    field.setFocused(true);
    event.currentTarget.select();
  }

  function handleInputBlur(event: FocusEvent) {
    const relatedTarget = event.relatedTarget as Element | null;
    if (relatedTarget && rootElement?.contains(relatedTarget)) {
      return;
    }

    field.setTouched(true);
    setFocusedState(false);
    field.setFocused(false);

    if (field.validationMode === 'onBlur') {
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

  const state: OTPFieldRootState = {
    ...field.state,
    complete: () => value().length === local.length,
    disabled,
    filled,
    focused,
    length: () => local.length,
    readOnly: () => local.readOnly,
    required: () => local.required,
    value,
  };

  const contextValue: OTPFieldRootContext = {
    activeIndex,
    autoComplete: () => local.autoComplete,
    disabled,
    form: () => local.form,
    focusInput,
    queueFocusInput,
    getInputId,
    handleInputBlur,
    handleInputFocus,
    inputMode,
    inputAriaLabelledBy,
    invalid: field.invalid,
    length: () => local.length,
    mask: () => local.mask,
    pattern,
    reportValueInvalid,
    readOnly: () => local.readOnly,
    required: () => local.required,
    normalizeValue: () => local.normalizeValue,
    setValue,
    state,
    validationType: () => local.validationType,
    value,
  };

  const rootProps = {
    role: 'group' as const,
    get 'aria-describedby'() {
      return ariaDescribedBy();
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
  };

  const rootRef = (element: HTMLDivElement | null) => {
    rootElement = element;
  };

  onCleanup(() => {
    rootElement = null;
  });

  function onHiddenInputFocus() {
    focusInput(0);
  }

  function onHiddenInput(event: Event & { currentTarget: HTMLInputElement }) {
    if (event.defaultPrevented || disabled() || local.readOnly) {
      return;
    }

    const rawValue = event.currentTarget.value;
    const [normalizedValue, didRejectCharacters] = normalizeOTPValueWithDetails(
      rawValue,
      local.length,
      local.validationType,
      local.normalizeValue,
    );

    if (didRejectCharacters) {
      reportValueInvalid(rawValue, createGenericEventDetails(REASONS.inputChange, event));
    }

    const committedValue = setValue(
      normalizedValue,
      createChangeEventDetails(REASONS.inputChange, event),
    );

    if (committedValue != null && committedValue !== '') {
      queueFocusInput(committedValue.length - 1, committedValue);
    }
  }

  const hiddenInputProps = {
    ref: (element: HTMLInputElement | null) => {
      field.validation.inputElement = element;
    },
    type: 'text' as const,
    get id() {
      return id() && name() == null ? `${id()}-hidden-input` : undefined;
    },
    get form() {
      return local.form;
    },
    get name() {
      return name();
    },
    get value() {
      return value();
    },
    get autoComplete() {
      return local.autoComplete;
    },
    get inputmode() {
      return inputMode();
    },
    get minlength() {
      return local.length;
    },
    get maxlength() {
      return local.length;
    },
    get pattern() {
      return hiddenInputPattern();
    },
    get disabled() {
      return disabled();
    },
    get readonly() {
      return local.readOnly;
    },
    get required() {
      return local.required;
    },
    'aria-hidden': 'true' as const,
    tabindex: -1,
    get style() {
      return name() ? visuallyHiddenInput : visuallyHidden;
    },
    onFocus: onHiddenInputFocus,
    onInput: onHiddenInput,
  };

  const hiddenInputValidationProps = (externalProps: Record<string, any>) =>
    field.validation.getValidationProps(disabled(), externalProps);

  return (
    <CompositeListContext value={compositeList.contextValue}>
      <OTPFieldRootContext value={contextValue}>
        <RenderElement
          as={as}
          state={state}
          props={[rootProps, elementProps, { ref: rootRef }]}
          stateAttributesMapping={rootStateAttributesMapping}
        />
        <Show when={hasValidLength()}>
          <RenderElement
            as="input"
            props={[hiddenInputProps, hiddenInputValidationProps]}
          />
        </Show>
      </OTPFieldRootContext>
    </CompositeListContext>
  );
}

const defaultProps = Object.freeze({
  as: 'div',
  autoComplete: 'one-time-code',
  autoSubmit: false,
  disabled: false,
  mask: false,
  readOnly: false,
  required: false,
  validationType: 'numeric',
} satisfies Partial<OTPFieldRoot.Props>);

export interface OTPFieldRootState extends FieldRootState {
  /**
   * Whether all slots are filled.
   */
  complete: () => boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: () => boolean;
  /**
   * The number of OTP input slots.
   */
  length: () => number;
  /**
   * Whether the user should be unable to change the field value.
   */
  readOnly: () => boolean;
  /**
   * Whether the user must enter a value before submitting a form.
   */
  required: () => boolean;
  /**
   * The OTP value.
   */
  value: () => string;
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
  onValueChange?:
    | ((value: string, eventDetails: OTPFieldRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * Callback fired when entered text contains characters that are rejected by validation or
   * normalization before the OTP value updates.
   *
   * The `value` argument is the attempted user-entered string before normalization.
   */
  onValueInvalid?:
    | ((value: string, eventDetails: OTPFieldRoot.InvalidEventDetails) => void)
    | undefined;
  /**
   * Callback function that is fired when the OTP value becomes complete, or when a complete value
   * is pasted while the OTP is already complete.
   *
   * When the value changes, it runs later than `onValueChange`, after the internal value update is
   * applied. If a complete pasted value matches the current value, `onValueChange` does not fire.
   *
   * If `autoSubmit` is enabled, it runs immediately before the owning form is submitted.
   */
  onValueComplete?:
    | ((value: string, eventDetails: OTPFieldRoot.CompleteEventDetails) => void)
    | undefined;
}

export type OTPFieldRootProps<T extends ValidComponent = 'div'> = OTPFieldRootOwnProps &
  Omit<RebaseUIComponentProps<T, OTPFieldRootState>, 'onChange'>;

export type OTPFieldInputMode =
  | 'none'
  | 'text'
  | 'tel'
  | 'url'
  | 'email'
  | 'numeric'
  | 'decimal'
  | 'search';

export type OTPFieldRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.inputPaste
  | typeof REASONS.keyboard;
export type OTPFieldRootChangeEventDetails =
  RebaseUIChangeEventDetails<OTPFieldRoot.ChangeEventReason>;

export type OTPFieldRootInvalidEventReason = typeof REASONS.inputChange | typeof REASONS.inputPaste;
export type OTPFieldRootInvalidEventDetails =
  RebaseUIGenericEventDetails<OTPFieldRoot.InvalidEventReason>;

export type OTPFieldRootCompleteEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputPaste;
export type OTPFieldRootCompleteEventDetails =
  RebaseUIGenericEventDetails<OTPFieldRoot.CompleteEventReason>;

export namespace OTPFieldRoot {
  export type State = OTPFieldRootState;
  export type Props<T extends ValidComponent = 'div'> = OTPFieldRootProps<T>;
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
  return ids.length > 0 ? Array.from(new Set(ids)).join(' ') : undefined;
}
