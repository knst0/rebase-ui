import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createUniqueId, untrack } from "solid-js";

import { EMPTY_ARRAY } from "#utils/empty";

import { isEligibleInput } from "../field/root/createFieldValidation";
import type { FieldRootState } from "../field/root/FieldRoot";
import { createControllableSignal } from "../internals/createControllableSignal";
import { type RebaseUIChangeEventDetails, REASONS } from "../internals/event-details";
import { fieldValidityMapping } from "../internals/field-constants";
import { createRegisterFieldControl } from "../internals/field-register-control";
import { useFieldRootContext } from "../internals/field-root-context";
import { useFormContext } from "../internals/form-context";
import { createLabelableId, useLabelableContext } from "../internals/labelable-provider";
import { RenderElement } from "../internals/render-element";
import { split } from "../internals/split";
import type { RebaseUIComponentProps } from "../internals/types";
import { CheckboxGroupContext } from "./CheckboxGroupContext";
import { createCheckboxGroupParent } from "./createCheckboxGroupParent";

/**
 * Provides a shared state to a series of checkboxes.
 *
 * Documentation: [Rebase UI Checkbox Group](https://rebase-ui.knst.dev/components/checkbox-group)
 */
export function CheckboxGroup<T extends ValidComponent = "div">(props: CheckboxGroup.Props<T>) {
  const [local, elementProps] = split(props as CheckboxGroup.Props, { default: defaultProps }, [
    "as",
    "allValues",
    "defaultValue",
    "disabled",
    "id",
    "onValueChange",
    "value",
  ]);

  const as = untrack(() => local.as);

  const {
    disabled: fieldDisabled,
    name: fieldName,
    state: fieldState,
    validation,
    setFilled,
    setDirty,
    validityData,
  } = useFieldRootContext();
  const { labelId, registerControlId, getDescriptionProps } = useLabelableContext();
  const form = useFormContext();

  const disabled = createMemo(() => fieldDisabled() === true || local.disabled === true);

  const [value, setValueUnwrapped] = createControllableSignal<readonly string[]>({
    value: () => local.value,
    defaultValue: () => local.defaultValue ?? (EMPTY_ARRAY as readonly string[]),
  });

  const setValue = (next: string[], eventDetails: CheckboxGroup.ChangeEventDetails) => {
    local.onValueChange?.(next, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(next);
  };

  const parent = createCheckboxGroupParent({
    allValues: () => local.allValues,
    value,
    onValueChange: setValue,
  });

  // The group is the field's control and takes its name from `aria-labelledby`, so `Field.Label`
  // must not point `for` at one arbitrary checkbox inside the group.
  createLabelableId({ id: () => null });

  const generatedId = createUniqueId();

  const getFormValue = () => {
    const formElement = form.formElement;
    if (!formElement) {
      return value();
    }

    const successfulValues = new Set<string>();
    for (const [input, registration] of validation.registeredInputs) {
      if (registration.value !== undefined && input.checked && isEligibleInput(input, formElement)) {
        successfulValues.add(registration.value);
      }
    }

    return value().filter((inputValue) => successfulValues.has(inputValue));
  };

  createRegisterFieldControl({
    controlElement: () => validation.getInputControl(),
    id: () => generatedId,
    value,
    getFormValue,
    enabled: () => !!fieldName() && !disabled(),
    name: fieldName,
  });

  createEffect(
    () => value().length > 0,
    (filled) => {
      setFilled(filled);
    },
  );

  let valueChanged = false;
  createEffect(
    () => value(),
    (next) => {
      if (!valueChanged) {
        valueChanged = true;
        return;
      }

      const name = fieldName();
      if (name) {
        form.clearErrors(name);
      }

      const initialValue = Array.isArray(validityData.initialValue)
        ? (validityData.initialValue as readonly string[])
        : (EMPTY_ARRAY as readonly string[]);

      setDirty(!areArraysEqual(next, initialValue));

      validation.change(next);
    },
  );

  const state: CheckboxGroupState = { ...fieldState, disabled };

  const contextValue: CheckboxGroupContext = {
    allValues: () => local.allValues,
    value,
    setValue,
    parent,
    disabled,
    validation,
    registerControlId,
  };

  const groupProps = {
    get id() {
      return local.id;
    },
    role: "group" as const,
    get "aria-labelledby"() {
      return labelId();
    },
  };

  return (
    <CheckboxGroupContext value={contextValue}>
      <RenderElement
        as={as}
        state={state}
        stateAttributesMapping={fieldValidityMapping}
        props={[groupProps, elementProps, getDescriptionProps]}
      />
    </CheckboxGroupContext>
  );
}

const defaultProps = Object.freeze({
  as: "div",
  disabled: false,
} satisfies Partial<CheckboxGroup.Props>);

function areArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

export interface CheckboxGroupState extends FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
}

export interface CheckboxGroupOwnProps {
  /**
   * Names of the checkboxes in the group that should be ticked.
   *
   * To render an uncontrolled checkbox group, use the `defaultValue` prop instead.
   */
  value?: string[] | undefined;
  /**
   * Names of the checkboxes in the group that should be initially ticked.
   *
   * To render a controlled checkbox group, use the `value` prop instead.
   */
  defaultValue?: string[] | undefined;
  /**
   * Event handler called when a checkbox in the group is ticked or unticked.
   * Provides the new value as an argument.
   */
  onValueChange?: ((value: string[], eventDetails: CheckboxGroup.ChangeEventDetails) => void) | undefined;
  /**
   * Names of all checkboxes in the group. Use this when creating a parent checkbox.
   */
  allValues?: string[] | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type CheckboxGroupProps<T extends ValidComponent = "div"> = CheckboxGroupOwnProps & RebaseUIComponentProps<T, CheckboxGroupState>;

export type CheckboxGroupChangeEventReason = typeof REASONS.none;

export type CheckboxGroupChangeEventDetails = RebaseUIChangeEventDetails<CheckboxGroup.ChangeEventReason>;

export namespace CheckboxGroup {
  export type State = CheckboxGroupState;
  export type Props<T extends ValidComponent = "div"> = CheckboxGroupProps<T>;
  export type OwnProps = CheckboxGroupOwnProps;
  export type ChangeEventReason = CheckboxGroupChangeEventReason;
  export type ChangeEventDetails = CheckboxGroupChangeEventDetails;
}
