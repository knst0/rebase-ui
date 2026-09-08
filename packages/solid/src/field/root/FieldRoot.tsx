import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createSignal, createStore, onCleanup, untrack } from "solid-js";

import { useFieldsetRootContext } from "../../fieldset/root/FieldsetRootContext";
import type { Form } from "../../form/Form";
import { DEFAULT_VALIDITY_STATE, fieldValidityMapping } from "../../internals/field-constants";
import { createFieldControlRegistration } from "../../internals/field-register-control";
import { FieldRootContext } from "../../internals/field-root-context";
import { useFormContext } from "../../internals/form-context";
import { LabelableProvider } from "../../internals/labelable-provider";
import { accessBoolean, type ReactiveBoolean } from "../../internals/maybeAccessor";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import { stableCallback } from "../../internals/stableCallback";
import type { ActionsRef, RebaseUIComponentProps } from "../../internals/types";
import { createFieldValidation } from "./createFieldValidation";

/**
 * Groups all parts of the field.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldRoot<T extends ValidComponent = "div">(props: FieldRoot.Props<T>) {
  return (
    <LabelableProvider>
      <FieldRootInner props={props as FieldRoot.Props} />
    </LabelableProvider>
  );
}

function FieldRootInner(ownerProps: { props: FieldRoot.Props }) {
  const [local, elementProps] = split(
    untrack(() => ownerProps.props),
    { default: defaultProps },
    ["as", "actionsRef", "dirty", "disabled", "invalid", "name", "touched", "validate", "validationDebounceTime", "validationMode"],
  );

  const rootFormContext = useFormContext();

  const as = untrack(() => local.as);
  const validationDebounceTime = untrack(() => local.validationDebounceTime);
  const validationMode = untrack(() => local.validationMode) ?? rootFormContext.validationMode;

  const disabledFieldset = useFieldsetRootContext(true)?.disabled;
  const disabled = () => accessBoolean(local.disabled) || (disabledFieldset ? disabledFieldset() : false);

  const validate = stableCallback(() => local.validate ?? (() => null));

  // const disabled = createMemo(() => fieldsetContext?.disabled() === true || local.disabled === true);

  const [touchedState, setTouchedState] = createSignal(false);
  const [dirtyState, setDirtyState] = createSignal(false);
  const [filled, setFilled] = createSignal(false);
  const [focused, setFocused] = createSignal(false);

  const dirty = createMemo(() => (local.dirty === undefined ? dirtyState() : accessBoolean(local.dirty)));
  const touched = createMemo(() => (local.touched === undefined ? touchedState() : accessBoolean(local.touched)));

  let markedDirty = false;
  const [registeredFieldName, setRegisteredFieldName] = createSignal<string>();
  const [registeredFieldId, setRegisteredFieldId] = createSignal<string>();

  const effectiveName = () => local.name ?? registeredFieldName();

  createEffect(
    () => local.dirty,
    (dirtyProp) => {
      if (dirtyProp !== undefined) {
        markedDirty = accessBoolean(dirtyProp);
      }
    },
  );

  const formErrors = createMemo(() => rootFormContext.errors());

  const setDirty = (value: boolean) => {
    if (local.dirty !== undefined) {
      return;
    }

    if (value) {
      markedDirty = true;
    }
    setDirtyState(value);
  };

  const setTouched = (value: boolean) => {
    if (local.touched !== undefined) {
      return;
    }
    setTouchedState(value);
  };

  const shouldValidateOnChange = () => {
    return validationMode === "onChange" || (validationMode === "onSubmit" && rootFormContext.submitCount() > 0);
  };

  const invalid = createMemo(() => {
    if (accessBoolean(local.invalid)) {
      return true;
    }

    const name = effectiveName();
    if (!name) {
      return false;
    }

    const errors = formErrors();
    if (!errors || !Object.hasOwn(errors, name)) {
      return false;
    }

    const formError = errors[name];
    return !!(Array.isArray(formError) ? formError.length : formError);
  });

  const [validityData, setValidityData] = createStore<FieldValidityData>({
    state: { ...DEFAULT_VALIDITY_STATE },
    error: "",
    errors: [],
    value: null,
    initialValue: null,
  });

  const valid = createMemo<boolean | null>(() => {
    if (invalid()) {
      return false;
    }
    if (disabled()) {
      return null;
    }
    return validityData.state.valid;
  });

  const state: FieldRootState = {
    disabled,
    touched,
    dirty,
    valid,
    filled,
    focused,
  };

  const validation = createFieldValidation({
    setValidityData,
    validate,
    validityData,
    validationDebounceTime,
    invalid,
    markedDirty: () => markedDirty,
    state,
    shouldValidateOnChange,
    registeredFieldId,
  });

  const [validateFieldControl, registerFieldControl] = createFieldControlRegistration({
    change: validation.change,
    commit: validation.commit,
    invalid,
    setMarkedDirty: (value) => {
      markedDirty = value;
    },
    name: () => local.name,
    setRegisteredFieldName,
    setRegisteredFieldId,
    setValidityData,
    validityData,
  });

  createEffect(
    () => local.actionsRef,
    (actionsRef) => {
      if (!actionsRef) {
        return;
      }

      actionsRef.current = { validate: validateFieldControl };

      onCleanup(() => {
        actionsRef.current = null;
      });
    },
  );

  const contextValue: FieldRootContext = {
    invalid,
    name: effectiveName,
    validityData,
    setValidityData,
    disabled,
    setTouched,
    setDirty,
    setFilled,
    setFocused,
    validationMode,
    shouldValidateOnChange,
    state,
    registerFieldControl,
    validation,
  };

  return (
    <FieldRootContext value={contextValue}>
      <RenderElement as={as} state={state} props={[elementProps]} stateAttributesMapping={fieldValidityMapping} />
    </FieldRootContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  disabled: () => false,
  validationDebounceTime: 0,
} satisfies Partial<FieldRoot.Props>);

export interface FieldValidityData {
  state: {
    badInput: boolean;
    customError: boolean;
    patternMismatch: boolean;
    rangeOverflow: boolean;
    rangeUnderflow: boolean;
    stepMismatch: boolean;
    tooLong: boolean;
    tooShort: boolean;
    typeMismatch: boolean;
    valueMissing: boolean;
    valid: boolean | null;
  };
  error: string;
  errors: string[];
  value: unknown;
  initialValue: unknown;
}

export interface FieldRootActions {
  validate: () => void;
}

export interface FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  /**
   * Whether the field has been touched.
   */
  touched: Accessor<boolean>;
  /**
   * Whether the field value has changed from its initial value.
   */
  dirty: Accessor<boolean>;
  /**
   * Whether the field is valid.
   */
  valid: Accessor<boolean | null>;
  /**
   * Whether the field has a value.
   */
  filled: Accessor<boolean>;
  /**
   * Whether the field is focused.
   */
  focused: Accessor<boolean>;
}

export interface FieldRootOwnProps {
  /**
   * Whether the component should ignore user interaction.
   * Takes precedence over the `disabled` prop on the `<Field.Control>` component.
   * @default false
   */
  disabled?: ReactiveBoolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   * Takes precedence over the `name` prop on the `<Field.Control>` component.
   */
  name?: string | undefined;
  /**
   * A function for custom validation. Return a string or an array of strings with
   * the error message(s) if the value is invalid, or `null` if the value is valid.
   * Asynchronous functions are supported, but they do not prevent form submission
   * when using `validationMode="onSubmit"`.
   */
  validate?: ((value: unknown, formValues: Form.Values) => string | string[] | null | Promise<string | string[] | null>) | undefined;
  /**
   * Determines when the field should be validated.
   * This takes precedence over the `validationMode` prop on `<Form>`.
   *
   * - `onSubmit`: triggers validation when the form is submitted, and re-validates on change after submission.
   * - `onBlur`: triggers validation when the control loses focus.
   * - `onChange`: triggers validation on every change to the control value.
   *
   * @default 'onSubmit'
   */
  validationMode?: Form.ValidationMode | undefined;
  /**
   * How long to wait between `validate` callbacks if
   * `validationMode="onChange"` is used. Specified in milliseconds.
   *
   * @nonReactive Captured on mount; updating this prop has no effect.
   * @default 0
   */
  validationDebounceTime?: number | undefined;
  /**
   * Whether the field is invalid.
   * Useful when the field state is controlled by an external library.
   */
  invalid?: ReactiveBoolean | undefined;
  /**
   * Whether the field's value has been changed from its initial value.
   * Useful when the field state is controlled by an external library.
   */
  dirty?: ReactiveBoolean | undefined;
  /**
   * Whether the field has been touched.
   * Useful when the field state is controlled by an external library.
   */
  touched?: ReactiveBoolean | undefined;
  /**
   * A ref to imperative actions.
   * - `validate`: Validates the field when called.
   */
  actionsRef?: ActionsRef<FieldRoot.Actions> | undefined;
}

export type FieldRootProps<T extends ValidComponent = "div"> = FieldRootOwnProps & RebaseUIComponentProps<T, FieldRootState>;

export namespace FieldRoot {
  export type State = FieldRootState;
  export type Props<T extends ValidComponent = "div"> = FieldRootProps<T>;
  export type OwnProps = FieldRootOwnProps;
  export type Actions = FieldRootActions;
}
