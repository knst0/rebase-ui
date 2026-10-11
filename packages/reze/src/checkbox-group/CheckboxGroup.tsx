import { createUniqueId, dynamicElement, effect, getOwner, omitProps, runWithOwner, untrack, type JSX } from "reze-js";

import { isEligibleInput } from "../field/root/createFieldValidation";
import type { FieldRootState } from "../field/root/FieldRoot";
import { createControllableSignal } from "../internals/createControllableSignal";
import { REASONS, type RebaseUIChangeEventDetails } from "../internals/event-details";
import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../internals/field-constants";
import { createRegisterFieldControl } from "../internals/field-register-control";
import { useFieldRootContext } from "../internals/field-root-context";
import { useFormContext } from "../internals/form-context";
import { createLabelableId, useLabelableContext } from "../internals/labelable-provider";
import { resolveClassValue, resolveStyleValue } from "../internals/renderProps";
import type { ChildrenValue, RebaseUIComponentProps } from "../internals/types";
import { CheckboxGroupContext, useCheckboxGroupContext } from "./CheckboxGroupContext";
import { createCheckboxGroupParent } from "./createCheckboxGroupParent";

const EMPTY_ARRAY: readonly string[] = [];

/**
 * Provides a shared state to a series of checkboxes.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Checkbox Group](https://rebase-ui.knst.dev/components/checkbox-group)
 */
export function CheckboxGroup<T extends JSX.ElementType = "div">(props: CheckboxGroup.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "allValues",
    "defaultValue",
    "disabled",
    "id",
    "onValueChange",
    "value",
    "aria-describedby",
    "class",
    "style",
    "children",
    "ref",
  );

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

  function disabled(): boolean {
    return fieldDisabled() === true || props.disabled === true;
  }

  const [value, setValueUnwrapped] = createControllableSignal<readonly string[]>({
    value: () => props.value,
    defaultValue: () => props.defaultValue ?? EMPTY_ARRAY,
  });

  function setValue(next: string[], eventDetails: CheckboxGroup.ChangeEventDetails): void {
    props.onValueChange?.(next, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(next);
  }

  const parent = createCheckboxGroupParent({
    allValues: () => props.allValues,
    value,
    onValueChange: setValue,
  });

  // The group is the field's control and takes its name from `aria-labelledby`, so `Field.Label`
  // must not point `for` at one arbitrary checkbox inside the group.
  createLabelableId({ id: () => null });

  const generatedId = createUniqueId();

  function getFormValue(): readonly string[] {
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
  }

  createRegisterFieldControl({
    controlElement: () => validation.getInputControl(),
    id: () => generatedId,
    value,
    getFormValue,
    enabled: () => !!fieldName() && !disabled(),
    name: fieldName,
  });

  effect(() => {
    const filled = value().length > 0;

    // Actions never subscribe: the write below only stores, so the effect tracks
    // just the group value above.
    untrack(() => setFilled(filled));
  });

  let valueChanged = false;
  effect(() => {
    const next = value();

    // Actions never subscribe: the field/form state below is consumed, never tracked.
    untrack(() => {
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
        : EMPTY_ARRAY;

      setDirty(!areArraysEqual(next, initialValue));

      validation.change(next);
    });
  });

  const selectors: FieldRootStateSelectors = { ...fieldState, disabled };

  const contextValue: CheckboxGroupContext = {
    allValues: () => props.allValues,
    value,
    setValue,
    parent,
    disabled,
    validation,
    registerControlId,
  };

  const externalDescriptionProps: Record<string, any> = {};
  Object.defineProperty(externalDescriptionProps, "aria-describedby", {
    enumerable: true,
    configurable: true,
    get: () => props["aria-describedby"],
  });
  const descriptionProps = getDescriptionProps(externalDescriptionProps);

  function snapshot(): CheckboxGroupState {
    return getFieldStateSnapshot(selectors);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would remount the
  // whole group subtree every time a message appears or disappears. The default path renders
  // a static `<div>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        id={props.id}
        role="group"
        aria-labelledby={labelId()}
        aria-describedby={descriptionProps["aria-describedby"]}
        data-disabled={disabled() ? "" : undefined}
        data-valid={selectors.valid() === true ? "" : undefined}
        data-invalid={selectors.valid() === false ? "" : undefined}
        data-touched={selectors.touched() ? "" : undefined}
        data-dirty={selectors.dirty() ? "" : undefined}
        data-filled={selectors.filled() ? "" : undefined}
        data-focused={selectors.focused() ? "" : undefined}
        data-validating={selectors.validating() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
      >
        <CheckboxGroupContext value={contextValue}>
          <CheckboxGroupContent>{props.children}</CheckboxGroupContent>
        </CheckboxGroupContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={props.id}
      role="group"
      aria-labelledby={labelId()}
      aria-describedby={descriptionProps["aria-describedby"]}
      data-disabled={disabled() ? "" : undefined}
      data-valid={selectors.valid() === true ? "" : undefined}
      data-invalid={selectors.valid() === false ? "" : undefined}
      data-touched={selectors.touched() ? "" : undefined}
      data-dirty={selectors.dirty() ? "" : undefined}
      data-filled={selectors.filled() ? "" : undefined}
      data-focused={selectors.focused() ? "" : undefined}
      data-validating={selectors.validating() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={props.ref as ((element: HTMLElement | null) => void) | undefined}
    >
      <CheckboxGroupContext value={contextValue}>
        <CheckboxGroupContent>{props.children}</CheckboxGroupContent>
      </CheckboxGroupContext>
    </Tag>
  );
}

/**
 * Resolves the group children inside the checkbox group context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the state changes, matching the Solid layer where the children
 * memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function CheckboxGroupContent(props: { children: ChildrenValue<CheckboxGroupState> }) {
  const children = props.children;

  const field = useFieldRootContext();
  const group = useCheckboxGroupContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: CheckboxGroupState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the field contexts (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const selectors: FieldRootStateSelectors = { ...field.state, disabled: group.disabled };
      const snapshot = getFieldStateSnapshot(selectors);

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

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

export interface CheckboxGroupState extends FieldRootState {}

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

export type CheckboxGroupProps<T extends JSX.ElementType = "div"> = CheckboxGroupOwnProps &
  RebaseUIComponentProps<T, CheckboxGroupState>;

export type CheckboxGroupChangeEventReason = typeof REASONS.none;

export type CheckboxGroupChangeEventDetails = RebaseUIChangeEventDetails<CheckboxGroup.ChangeEventReason>;

export namespace CheckboxGroup {
  export type State = CheckboxGroupState;
  export type Props<T extends JSX.ElementType = "div"> = CheckboxGroupProps<T>;
  export type OwnProps = CheckboxGroupOwnProps;
  export type ChangeEventReason = CheckboxGroupChangeEventReason;
  export type ChangeEventDetails = CheckboxGroupChangeEventDetails;
}
