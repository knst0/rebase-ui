import { dynamicElement, effect, getOwner, omitProps, onCleanup, runWithOwner, store, untrack, type JSX } from "reze-js";

import { useFieldsetRootContext } from "../../fieldset/root/FieldsetRootContext";
import type { Form } from "../../form/Form";
import { DEFAULT_VALIDITY_STATE, getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { createFieldControlRegistration } from "../../internals/field-register-control";
import { FieldRootContext, useFieldRootContext } from "../../internals/field-root-context";
import { FormContext, useFormContext } from "../../internals/form-context";
import { LabelableContext, LabelableProvider, useLabelableContext } from "../../internals/labelable-provider";
import { accessBoolean, type ReactiveBoolean } from "../../internals/maybeAccessor";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import { stableCallback } from "../../internals/stableCallback";
import type { ChildrenValue, RebaseUIComponentProps } from "../../internals/types";
import { createFieldValidation } from "./createFieldValidation";

/**
 * Groups all parts of the field.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldRoot<T extends JSX.ElementType = "div">(props: FieldRoot.Props<T>) {
  return (
    <LabelableProvider>
      <FieldRootInner elementProps={props}>{props.children}</FieldRootInner>
    </LabelableProvider>
  );
}

function FieldRootInner<T extends JSX.ElementType>(props: {
  elementProps: FieldRoot.Props<T>;
  children?: ChildrenValue<FieldRootState> | undefined;
}) {
  const outer = props.elementProps;
  const rest = omitProps(
    outer,
    "as",
    "actionsRef",
    "dirty",
    "disabled",
    "invalid",
    "name",
    "touched",
    "validate",
    "validationDebounceTime",
    "validationMode",
    "class",
    "style",
    "children",
    "ref",
  );

  const labelable = useLabelableContext();
  const formContext = useFormContext();

  const validationMode = outer.validationMode ?? formContext.validationMode;
  const validationDebounceTime = outer.validationDebounceTime ?? 0;

  const fieldset = useFieldsetRootContext(true);

  function disabled(): boolean {
    return accessBoolean(outer.disabled) || fieldset?.disabled() === true;
  }

  const validate = stableCallback(() => outer.validate ?? (() => null));

  const state = store({
    touched: false,
    dirty: false,
    filled: false,
    focused: false,
    registeredFieldName: undefined as string | undefined,
    registeredFieldId: undefined as string | undefined,
  });

  const validityData = store<FieldValidityData>({
    state: { ...DEFAULT_VALIDITY_STATE },
    error: "",
    errors: [],
    value: null,
    initialValue: null,
    isValidating: false,
  });

  let markedDirty = false;
  let focusOwner: unknown;

  function dirty(): boolean {
    const dirtyProp = outer.dirty;
    return dirtyProp === undefined ? state.dirty : accessBoolean(dirtyProp);
  }

  function touched(): boolean {
    const touchedProp = outer.touched;
    return touchedProp === undefined ? state.touched : accessBoolean(touchedProp);
  }

  function effectiveName(): string | undefined {
    return outer.name ?? state.registeredFieldName;
  }

  effect(() => {
    const dirtyProp = outer.dirty;

    // Actions never subscribe: only the prop identity is tracked, the accessor
    // it may hold is consumed untracked.
    untrack(() => {
      if (dirtyProp !== undefined) {
        markedDirty = accessBoolean(dirtyProp);
      }
    });
  });

  function setDirty(value: boolean) {
    if (outer.dirty !== undefined) {
      return;
    }

    if (value) {
      markedDirty = true;
    }
    state.dirty = value;
  }

  function setTouched(value: boolean) {
    if (outer.touched !== undefined) {
      return;
    }
    state.touched = value;
  }

  function setFilled(value: boolean) {
    state.filled = value;
  }

  function setFocused(value: boolean) {
    state.focused = value;
  }

  function shouldValidateOnChange(): boolean {
    return validationMode === "onChange" || (validationMode === "onSubmit" && formContext.submitCount() > 0);
  }

  function invalid(): boolean {
    if (accessBoolean(outer.invalid)) {
      return true;
    }

    const fieldName = effectiveName();
    if (!fieldName) {
      return false;
    }

    const errors = formContext.errors();
    if (!errors || !Object.hasOwn(errors, fieldName)) {
      return false;
    }

    const formError = errors[fieldName];
    return !!(Array.isArray(formError) ? formError.length : formError);
  }

  function valid(): boolean | null {
    if (invalid()) {
      return false;
    }
    if (disabled()) {
      return null;
    }
    return validityData.state.valid;
  }

  const setValidityData: FieldValiditySetter = (updater) => {
    const next = updater(validityData);
    if (next === undefined) {
      return;
    }
    validityData.state = next.state;
    validityData.error = next.error;
    validityData.errors = next.errors;
    validityData.value = next.value;
    validityData.initialValue = next.initialValue;
    validityData.isValidating = next.isValidating;
  };

  const selectors: FieldRootStateSelectors = {
    disabled,
    touched,
    dirty,
    valid,
    filled: () => state.filled,
    focused: () => state.focused,
    validating: () => validityData.isValidating,
  };

  const validation = createFieldValidation({
    setValidityData,
    validate,
    validityData,
    validationDebounceTime,
    validationMode,
    invalid,
    markedDirty: () => markedDirty,
    state: selectors,
    shouldValidateOnChange,
    registeredFieldId: () => state.registeredFieldId,
  });

  const [validateFieldControl, registerFieldControl] = createFieldControlRegistration({
    change: validation.change,
    commit: validation.commit,
    invalid,
    setMarkedDirty: (value) => {
      markedDirty = value;
    },
    name: () => outer.name,
    setRegisteredFieldName: (fieldName) => {
      state.registeredFieldName = fieldName;
    },
    setRegisteredFieldId: (id) => {
      state.registeredFieldId = id;
    },
    setValidityData,
    validityData,
  });

  effect(() => {
    const actionsRef = outer.actionsRef;
    if (!actionsRef) {
      return;
    }

    actionsRef({ validate: validateFieldControl });

    onCleanup(() => {
      actionsRef(null);
    });
  });

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
    getFocusOwner: () => focusOwner,
    setFocusOwner: (owner) => {
      focusOwner = owner;
    },
    validationMode,
    shouldValidateOnChange,
    state: selectors,
    registerFieldControl,
    validation,
  };

  const Tag = dynamicElement<JSX.ElementType>(() => outer.as ?? "div");

  function snapshot(): FieldRootState {
    return getFieldStateSnapshot(selectors);
  }

  // The providers live inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the field parts without context. The labelable
  // and form scopes are re-provided by identity so the parts share the root's own
  // scope instead of a fresh one. Children resolve in FieldRootContent below so they
  // are created inside the providers.
  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      data-disabled={disabled() ? "" : undefined}
      data-valid={valid() === true ? "" : undefined}
      data-invalid={valid() === false ? "" : undefined}
      data-touched={touched() ? "" : undefined}
      data-dirty={dirty() ? "" : undefined}
      data-filled={state.filled ? "" : undefined}
      data-focused={state.focused ? "" : undefined}
      data-validating={validityData.isValidating ? "" : undefined}
      class={resolveClassValue(outer.class, snapshot())}
      style={resolveStyleValue(outer.style, snapshot())}
      ref={outer.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <LabelableContext value={labelable}>
        <FormContext value={formContext}>
          <FieldRootContext value={contextValue}>
            <FieldRootContent>{props.children}</FieldRootContent>
          </FieldRootContext>
        </FormContext>
      </LabelableContext>
    </Tag>
  );
}

/**
 * Resolves the root children inside the field contexts. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the state changes, matching the Solid layer where the children
 * memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function FieldRootContent(props: { children: ChildrenValue<FieldRootState> }) {
  const children = props.children;

  const { state } = useFieldRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: FieldRootState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the field contexts (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot = getFieldStateSnapshot(state);

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

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
  /**
   * Whether an async validator is currently in flight. Reset when the latest
   * validation run settles or is superseded.
   */
  isValidating: boolean;
}

/**
 * Replaces the validity data wholesale when the updater returns a value, or
 * applies its in-place mutations when it returns `undefined` — mirroring the
 * Solid store setter both call shapes below rely on.
 */
export type FieldValiditySetter = (updater: (draft: FieldValidityData) => FieldValidityData | void) => void;

export interface FieldRootActions {
  validate: () => void;
}

export interface FieldRootState {
  disabled: boolean;
  /**
   * Whether the field has been touched.
   */
  touched: boolean;
  /**
   * Whether the field value has changed from its initial value.
   */
  dirty: boolean;
  /**
   * Whether the field is valid.
   */
  valid: boolean | null;
  /**
   * Whether the field has a value.
   */
  filled: boolean;
  /**
   * Whether the field is focused.
   */
  focused: boolean;
  /**
   * Whether an async validator is currently in flight.
   */
  validating: boolean;
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
   * A callback that receives the imperative actions.
   * - `validate`: Validates the field when called.
   */
  actionsRef?: ((actions: FieldRoot.Actions | null) => void) | undefined;
}

export type FieldRootProps<T extends JSX.ElementType = "div"> = FieldRootOwnProps & RebaseUIComponentProps<T, FieldRootState>;

export namespace FieldRoot {
  export type State = FieldRootState;
  export type Props<T extends JSX.ElementType = "div"> = FieldRootProps<T>;
  export type OwnProps = FieldRootOwnProps;
  export type Actions = FieldRootActions;
}
