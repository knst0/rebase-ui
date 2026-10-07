import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createSignal, createUniqueId, untrack } from "solid-js";

import { serializeValue } from "#utils/serializeValue";

import { isEligibleInput } from "../field/root/createFieldValidation";
import type { FieldRootState } from "../field/root/FieldRoot";
import { useFieldsetRootContext } from "../fieldset/root/FieldsetRootContext";
import { CompositeRoot, SHIFT } from "../internals/composite";
import { createControllableSignal } from "../internals/createControllableSignal";
import { type RebaseUIChangeEventDetails, REASONS } from "../internals/event-details";
import { fieldValidityMapping } from "../internals/field-constants";
import { createRegisterFieldControl } from "../internals/field-register-control";
import { useFieldRootContext } from "../internals/field-root-context";
import { useFormContext } from "../internals/form-context";
import { createLabelableId, useLabelableContext } from "../internals/labelable-provider";
import { makeEventPreventable } from "../internals/makeEventPreventable";
import { split } from "../internals/split";
import type { RebaseUIComponentProps } from "../internals/types";
import { RadioGroupContext } from "./RadioGroupContext";

const MODIFIER_KEYS = [SHIFT] as const;

/**
 * Provides a shared state to a series of radio buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Radio](https://rebase-ui.knst.dev/components/radio)
 */
export function RadioGroup<Value, T extends ValidComponent = "div">(props: RadioGroup.Props<Value, T>) {
  const [local, elementProps] = split(props as RadioGroup.Props<Value>, { default: defaultProps }, [
    "as",
    "defaultValue",
    "disabled",
    "form",
    "id",
    "inputRef",
    "name",
    "onValueChange",
    "readOnly",
    "required",
    "value",
  ]);

  const as = untrack(() => local.as);

  const {
    setTouched: setFieldTouched,
    setFocused,
    validationMode,
    name: fieldName,
    disabled: fieldDisabled,
    state: fieldState,
    validation,
    setDirty,
    setFilled,
    validityData,
  } = useFieldRootContext();
  const { labelId } = useLabelableContext();
  const { clearErrors } = useFormContext();
  const fieldsetContext = useFieldsetRootContext(true);
  const form = useFormContext();

  const disabled = createMemo(() => fieldDisabled() === true || local.disabled === true);
  const name = () => fieldName() ?? local.name;

  const [checkedValue, setCheckedValueUnwrapped] = createControllableSignal<Value>({
    value: () => local.value,
    defaultValue: () => local.defaultValue as Value,
  });
  const [touched, setTouched] = createSignal(false);

  const setCheckedValue = (value: Value, eventDetails: RadioGroup.ChangeEventDetails) => {
    // Activation unchecks the previous native radio before change fires.
    // Restore it until the proposed value is accepted and projected by Solid.
    const currentValue = untrack(checkedValue);
    if (groupInputRef) {
      groupInputRef.checked = currentValue !== undefined && groupInputRef.value === serializeValue(currentValue);
    }

    local.onValueChange?.(value, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setCheckedValueUnwrapped(value);
  };

  let groupInputRef: HTMLInputElement | null = null;
  let firstEnabledInputRef: HTMLInputElement | null = null;

  // Only forwards the public `inputRef` and tracks the current representative for that forwarding.
  // The registry (`validation.registeredInputs`) is authoritative for validation and form-value
  // projection, so the group must not write `validation.inputRef`: a stale, unmounted radio left
  // there would become the Field's fallback once the registry empties and keep blocking submission.
  function setInputRef(hiddenInput: HTMLInputElement | null) {
    let cleanup: void | (() => void) | undefined;

    if (local.inputRef) {
      cleanup = local.inputRef(hiddenInput);
    }

    groupInputRef = hiddenInput;

    return cleanup;
  }

  const registerInputRef = (input: HTMLInputElement | null) => {
    if (!input || input.disabled) {
      return undefined;
    }

    if (!firstEnabledInputRef) {
      firstEnabledInputRef = input;
    }

    const currentInput = groupInputRef;
    const cleanup = input.checked || currentInput == null || currentInput.disabled ? setInputRef(input) : undefined;

    // Detach when this input unmounts while still forwarded, so consumers don't
    // keep holding a disconnected node. The input may have become the forwarded
    // one after attach (via the re-registration effect), so always return this.
    return () => {
      if (firstEnabledInputRef === input) {
        firstEnabledInputRef = null;
      }
      if (groupInputRef === input) {
        if (cleanup) {
          cleanup();
          groupInputRef = null;
        } else {
          setInputRef(null);
        }
      } else {
        cleanup?.();
      }
    };
  };

  const getFormValue = () => {
    const formElement = form.formElement;
    if (!formElement) {
      return (checkedValue() ?? null) as Value | null;
    }

    for (const input of validation.registeredInputs.keys()) {
      if (input.checked && isEligibleInput(input, formElement)) {
        return (checkedValue() ?? null) as Value | null;
      }
    }

    return null;
  };

  // The group is the field's control and takes its name from `aria-labelledby`, so `Field.Label`
  // must not point `for` at the group element itself.
  createLabelableId({ id: () => null });

  const generatedId = createUniqueId();

  createRegisterFieldControl({
    controlElement: () => validation.getInputControl(),
    id: () => generatedId,
    value: checkedValue as Accessor<unknown>,
    getFormValue,
    enabled: () => !!fieldName() && !disabled(),
    name: fieldName,
  });

  createEffect(
    () => checkedValue() != null,
    (filled) => {
      setFilled(filled);
    },
  );

  let valueChanged = false;
  createEffect(
    () => checkedValue(),
    (next) => {
      if (!valueChanged) {
        valueChanged = true;
        return;
      }

      const field = fieldName();
      if (field) {
        clearErrors(field);
      }

      setDirty(next !== validityData.initialValue);
      validation.change(next);

      const fallbackInput = firstEnabledInputRef;
      if (next == null && fallbackInput && !fallbackInput.disabled) {
        // Imperative re-point outside the ref lifecycle; the ref-callback cleanup isn't tracked here.
        setInputRef(fallbackInput);
      }
    },
  );

  const state: RadioGroupState = {
    ...fieldState,
    disabled,
    readOnly: () => local.readOnly,
    required: () => local.required,
  };

  const contextValue: RadioGroupContext<Value> = {
    checkedValue,
    disabled,
    form: untrack(() => local.form),
    validation,
    name: untrack(name),
    readOnly: () => local.readOnly,
    registerInputRef,
    required: () => local.required,
    setCheckedValue,
    setTouched,
    touched,
  };

  const [groupElement, setGroupElement] = createSignal<HTMLElement | null>(null);

  // The group marks itself touched on arrow keys in the capture phase, before
  // the composite item handlers move focus, so the newly focused radio can
  // select itself on focus.
  createEffect(
    () => groupElement(),
    (element) => {
      if (!element) {
        return undefined;
      }

      element.addEventListener("keydown", onKeyDownCapture, { capture: true });
      return () => {
        element.removeEventListener("keydown", onKeyDownCapture);
      };
    },
  );

  function onKeyDownCapture(event: KeyboardEvent) {
    if (event.key.startsWith("Arrow")) {
      setTouched(true);
      setFocused(true);
    }
  }

  const groupProps = {
    get id() {
      return local.id;
    },
    role: "radiogroup" as const,
    get "aria-required"(): "true" | undefined {
      return local.required ? "true" : undefined;
    },
    get "aria-disabled"(): "true" | undefined {
      return disabled() ? "true" : undefined;
    },
    get "aria-readonly"(): "true" | undefined {
      return local.readOnly ? "true" : undefined;
    },
    get "aria-labelledby"() {
      return labelId() ?? fieldsetContext?.legendId();
    },
  };

  const groupHandlers = (externalProps: Record<string, any>) => {
    const target: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "onFocus" || key === "onBlur") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    chainHandler("onFocus", () => {
      setFocused(true);
    });

    chainHandler("onBlur", (event: FocusEvent) => {
      const currentTarget = event.currentTarget as HTMLElement | null;
      const relatedTarget = event.relatedTarget as Node | null;
      if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
        return;
      }

      setTouched(false);
      setFieldTouched(true);
      setFocused(false);

      if (validationMode === "onBlur") {
        void validation.commit(checkedValue());
      }
    });

    function chainHandler(key: string, internal: (event: any) => void) {
      const external = externalProps[key] as ((event: any) => void) | undefined;
      target[key] = (event: Event) => {
        makeEventPreventable(event as any);
        external?.(event);
        if ((event as any).rebaseUIHandlerPrevented) {
          return;
        }
        internal(event);
      };
    }

    return target;
  };

  const validationProps = (externalProps: Record<string, any>) => validation.getValidationProps(disabled(), externalProps);

  return (
    <RadioGroupContext value={contextValue}>
      <CompositeRoot
        as={as}
        state={state}
        props={[groupProps, elementProps, groupHandlers, validationProps]}
        ref={setGroupElement}
        stateAttributesMapping={fieldValidityMapping}
        enableHomeAndEndKeys={false}
        modifierKeys={MODIFIER_KEYS}
      />
    </RadioGroupContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  disabled: false,
  readOnly: false,
  required: false,
} satisfies Partial<RadioGroup.Props<any>>);

export interface RadioGroupState extends FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  /**
   * Whether the user should be unable to select a different radio button in the group.
   */
  readOnly: Accessor<boolean>;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required: Accessor<boolean>;
}

export interface RadioGroupOwnProps<Value = any> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to select a different radio button in the group.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the radio inputs.
   * Useful when the radio group is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The controlled value of the radio item that should be currently selected.
   *
   * To render an uncontrolled radio group, use the `defaultValue` prop instead.
   */
  value?: Value | undefined;
  /**
   * The uncontrolled value of the radio button that should be initially selected.
   *
   * To render a controlled radio group, use the `value` prop instead.
   */
  defaultValue?: Value | undefined;
  /**
   * Callback fired when the value changes.
   */
  onValueChange?: ((value: Value, eventDetails: RadioGroup.ChangeEventDetails) => void) | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: ((element: HTMLInputElement | null) => void) | undefined;
}

export type RadioGroupProps<Value = any, T extends ValidComponent = "div"> = RadioGroupOwnProps<Value> &
  RebaseUIComponentProps<T, RadioGroupState>;

export type RadioGroupChangeEventReason = typeof REASONS.none;

export type RadioGroupChangeEventDetails = RebaseUIChangeEventDetails<RadioGroup.ChangeEventReason>;

export namespace RadioGroup {
  export type State = RadioGroupState;
  export type Props<Value = any, T extends ValidComponent = "div"> = RadioGroupProps<Value, T>;
  export type OwnProps<Value = any> = RadioGroupOwnProps<Value>;
  export type ChangeEventReason = RadioGroupChangeEventReason;
  export type ChangeEventDetails = RadioGroupChangeEventDetails;
}
