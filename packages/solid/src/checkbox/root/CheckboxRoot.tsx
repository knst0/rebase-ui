import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createSignal, createUniqueId, untrack } from "solid-js";

import { dispatchClickWithModifiers } from "#utils/dispatchClickWithModifiers";
import { EMPTY_OBJECT } from "#utils/empty";
import { getDefaultFormSubmitter } from "#utils/getDefaultFormSubmitter";
import { ownerWindow } from "#utils/owner";
import { visuallyHidden, visuallyHiddenInput } from "#utils/visuallyHidden";

import { useCheckboxGroupContext } from "../../checkbox-group/CheckboxGroupContext";
import { useFieldItemContext } from "../../field/item/FieldItemContext";
import type { FieldRootState } from "../../field/root/FieldRoot";
import { createButton } from "../../internals/create-button";
import { createControllableSignal } from "../../internals/createControllableSignal";
import { createChangeEventDetails, type RebaseUIChangeEventDetails, REASONS } from "../../internals/event-details";
import { createRegisterFieldControl } from "../../internals/field-register-control";
import { useFieldRootContext } from "../../internals/field-root-context";
import { useFormContext } from "../../internals/form-context";
import { createAriaLabelledBy, createLabelableId, useLabelableContext } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { getCheckboxStateAttributesMapping } from "../utils/getCheckboxStateAttributesMapping";
import { CheckboxRootContext } from "./CheckboxRootContext";

export const PARENT_CHECKBOX = "data-parent";

/**
 * Represents the checkbox itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Rebase UI Checkbox](https://rebase-ui.knst.dev/components/checkbox)
 */
export function CheckboxRoot<T extends ValidComponent = "span">(props: CheckboxRoot.Props<T>) {
  const [local, elementProps] = split(props as CheckboxRoot.Props, { default: defaultProps }, [
    "as",
    "aria-labelledby",
    "checked",
    "defaultChecked",
    "disabled",
    "form",
    "id",
    "indeterminate",
    "inputRef",
    "name",
    "nativeButton",
    "onCheckedChange",
    "parent",
    "readOnly",
    "required",
    "uncheckedValue",
    "value",
  ]);

  const as = untrack(() => local.as);
  const nativeButton = untrack(() => local.nativeButton);

  const form = useFormContext();
  const {
    disabled: rootDisabled,
    name: fieldName,
    setDirty,
    setFilled,
    setFocused,
    setTouched,
    state: fieldState,
    validationMode,
    validityData,
    validation: localValidation,
  } = useFieldRootContext();
  const { disabled: itemDisabled } = useFieldItemContext();
  const { labelId, registerControlId, getDescriptionProps } = useLabelableContext();

  const groupContext = useCheckboxGroupContext(true);
  const parentContext = () => (groupContext?.allValues() === undefined ? undefined : groupContext.parent);
  const isGroupedWithParent = () => parentContext() !== undefined;

  const disabled = createMemo(
    () => rootDisabled() === true || itemDisabled() || groupContext?.disabled() === true || local.disabled === true,
  );
  const name = () => fieldName() ?? local.name;
  const value = () => local.value ?? name();

  const generatedId = createUniqueId();

  // A `CheckboxGroup` is the field's control and takes its name from `aria-labelledby`, so the
  // checkboxes sharing its labelable scope must not claim the field's control id: they would all
  // render that one id and collide. A `Field.Item` opens a scope the checkbox does own.
  const ownsControlId = () => groupContext?.registerControlId !== registerControlId;

  // `|| undefined` rather than `??`: an empty `id` falls back to the scope's control id.
  const controlId = createLabelableId({ id: () => local.id || undefined, enabled: ownsControlId });

  const rootId = () => (nativeButton ? controlId() : generatedId);

  const groupProps = () => {
    if (!isGroupedWithParent()) {
      return EMPTY_OBJECT as Record<string, any>;
    }

    const parent = parentContext()!;
    if (local.parent) {
      return parent.getParentProps() as Record<string, any>;
    }

    const currentValue = value();
    return currentValue !== undefined ? (parent.getChildProps(currentValue) as Record<string, any>) : (EMPTY_OBJECT as Record<string, any>);
  };

  const groupChecked = () => {
    const props = groupProps();
    return "checked" in props ? props.checked : local.checked;
  };
  const groupIndeterminate = () => {
    const props = groupProps();
    return "indeterminate" in props ? props.indeterminate : local.indeterminate;
  };
  const groupOnChange = () =>
    groupProps().onCheckedChange as ((checked: boolean, details: CheckboxRoot.ChangeEventDetails) => void) | undefined;

  const groupValue = () => groupContext?.value();

  const validation = groupContext?.validation ?? localValidation;

  const [checked, setCheckedState] = createControllableSignal<boolean>({
    value: () => {
      const currentValue = value();
      const currentGroupValue = groupValue();
      return currentValue !== undefined && currentGroupValue !== undefined && !local.parent
        ? currentGroupValue.includes(currentValue)
        : groupChecked();
    },
    defaultValue: () => local.defaultChecked,
  });

  const computedChecked = () => (isGroupedWithParent() ? Boolean(groupChecked()) : (checked() ?? false));
  const computedIndeterminate = () => (isGroupedWithParent() ? groupIndeterminate() || local.indeterminate : local.indeterminate);

  let controlElement: HTMLElement | null = null;
  let inputElement: HTMLInputElement | null = null;
  const [labelSource, setLabelSource] = createSignal<HTMLInputElement | null>(null);

  const { getButtonProps, buttonRef } = createButton({ disabled, native: () => nativeButton });

  createRegisterFieldControl({
    controlElement: () => controlElement,
    id: () => generatedId,
    value: checked,
    enabled: () => !groupContext && !disabled(),
    name: () => local.name,
  });

  const registeredInputValue = () => (groupContext ? value() : undefined);
  const registerInput = (element: HTMLInputElement) =>
    validation.registerInput(element, {
      get controlElement() {
        return controlElement;
      },
      value: registeredInputValue(),
    });

  const mergedInputRef = mergeRefs(
    local.inputRef,
    (element: HTMLInputElement) => {
      inputElement = element;
      setLabelSource(element);
    },
    local.parent ? undefined : registerInput,
  );

  const ariaLabelledBy = createAriaLabelledBy({
    ariaLabelledBy: () => local["aria-labelledby"] as string | undefined,
    labelId,
    labelSource,
    enableFallback: () => !nativeButton,
    labelSourceId: controlId,
  });

  createEffect(
    () => ({ indeterminate: computedIndeterminate(), checked: checked() ?? false }),
    ({ indeterminate, checked: isChecked }) => {
      if (inputElement) {
        // Re-assert on `checked` changes too: clicking the input natively resets `indeterminate`.
        inputElement.indeterminate = indeterminate;
      }

      // Inside a group, the group derives the filled state from its value.
      if (!groupContext) {
        setFilled(isChecked);
      }
    },
  );

  let checkedChanged = false;
  createEffect(
    () => checked() ?? false,
    (isChecked) => {
      if (!checkedChanged) {
        checkedChanged = true;
        return;
      }

      if (groupContext) {
        return;
      }

      // One-shot reads from an apply callback: the field/form state is consumed, never tracked.
      untrack(() => {
        form.clearErrors(name());
        setDirty(isChecked !== validityData.initialValue);

        validation.change(isChecked);
      });
    },
  );

  createEffect(
    () => ({ parent: parentContext(), currentValue: value(), isDisabled: disabled() }),
    ({ parent, currentValue, isDisabled }) => {
      if (!parent || currentValue === undefined) {
        return;
      }

      parent.disabledStates.set(currentValue, isDisabled);

      return () => {
        parent.disabledStates.delete(currentValue);
      };
    },
  );

  createEffect(
    () => ({ parent: parentContext(), currentValue: value(), id: rootId(), isParent: local.parent }),
    ({ parent, currentValue, id, isParent }) => {
      if (!parent || isParent || currentValue === undefined || id === undefined) {
        return;
      }

      return parent.registerChildId(currentValue, id);
    },
  );

  const state: CheckboxRootState = {
    ...fieldState,
    checked: computedChecked,
    disabled,
    readOnly: () => local.readOnly,
    required: () => local.required,
    indeterminate: computedIndeterminate,
  };

  const rootProps = {
    get id() {
      return rootId();
    },
    role: "checkbox" as const,
    get "aria-checked"(): "true" | "false" | "mixed" {
      return computedIndeterminate() ? "mixed" : computedChecked() ? "true" : "false";
    },
    get "aria-readonly"(): "true" | undefined {
      return local.readOnly ? "true" : undefined;
    },
    get "aria-required"(): "true" | undefined {
      return local.required ? "true" : undefined;
    },
    get "aria-labelledby"() {
      return ariaLabelledBy();
    },
    get [PARENT_CHECKBOX](): "" | undefined {
      return local.parent ? "" : undefined;
    },
  };

  const otherGroupProps: Record<string, any> = {};
  if (untrack(isGroupedWithParent) && untrack(() => local.parent)) {
    Object.defineProperty(otherGroupProps, "aria-controls", {
      enumerable: true,
      configurable: true,
      get: () => groupProps()["aria-controls"],
    });
  }

  const rootHandlers = (externalProps: Record<string, any>) => {
    const target: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "onFocus" || key === "onBlur" || key === "onKeyDown" || key === "onClick") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    chainHandler("onFocus", () => {
      if (!disabled()) {
        setFocused(true);
      }
    });

    chainHandler("onBlur", () => {
      if (!inputElement) {
        return;
      }

      setTouched(true);
      setFocused(false);

      if (validationMode === "onBlur") {
        void validation.commit(groupContext ? groupValue() : inputElement.checked);
      }
    });

    chainHandler("onClick", (event: MouseEvent) => {
      if (local.readOnly || disabled()) {
        return;
      }

      event.preventDefault();

      if (!inputElement) {
        return;
      }

      dispatchClickWithModifiers(inputElement, event);
    });

    chainHandler("onKeyDown", (event: KeyboardEvent) => {
      if (event.key !== "Enter") {
        return;
      }

      // Enter must not toggle the checkbox, but a consumer handler running later during
      // propagation still needs to be able to opt out of submitting the form.
      const formToSubmit = inputElement?.form ?? null;
      const currentTarget = event.currentTarget as Element;
      const originalPreventDefault = event.preventDefault.bind(event);
      let preventDefaultCalledAfterPropagation = false;

      event.preventDefault();

      (event as any).preventDefault = () => {
        preventDefaultCalledAfterPropagation = true;
        originalPreventDefault();
      };

      ownerWindow(currentTarget).queueMicrotask(() => {
        (event as any).preventDefault = originalPreventDefault;

        if (!preventDefaultCalledAfterPropagation) {
          getDefaultFormSubmitter(formToSubmit)?.click();
        }
      });
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

  const ref = mergeRefs(buttonRef, (element: HTMLElement) => {
    controlElement = element;
  });

  const inputValue = () => {
    if (local.value === undefined) {
      return undefined;
    }
    return (groupContext ? (checked() ?? false) && local.value : local.value) || "";
  };

  const inputProps = (externalProps: Record<string, any>) => validation.getValidationProps(disabled(), getDescriptionProps(externalProps));

  return (
    <CheckboxRootContext value={state}>
      <RenderElement
        as={as}
        state={state}
        stateAttributesMapping={getCheckboxStateAttributesMapping(state)}
        props={[rootProps, elementProps, rootHandlers, otherGroupProps, getButtonProps, getDescriptionProps, { ref }]}
      />
      {!computedChecked() && !groupContext && name() && !local.parent && local.uncheckedValue !== undefined && (
        <input type="hidden" form={local.form} name={name()} value={local.uncheckedValue} disabled={disabled()} />
      )}
      <RenderElement
        as="input"
        props={[
          {
            ref: mergedInputRef,
            type: "checkbox",
            "aria-hidden": "true",
            tabindex: -1,
            get checked() {
              return checked() ?? false;
            },
            get disabled() {
              return disabled();
            },
            get form() {
              return local.form;
            },
            // Parent checkboxes unset `name` to be excluded from form submission.
            get name() {
              return local.parent ? undefined : name();
            },
            // Set `id` to stop Chrome warning about an unassociated input.
            // When using a native button, the `id` is applied to the button instead.
            get id() {
              return nativeButton ? undefined : controlId();
            },
            get required() {
              return local.required;
            },
            get value() {
              return inputValue();
            },
            get style() {
              return name() ? visuallyHiddenInput : visuallyHidden;
            },
            onChange: onInputChange,
            // The click dispatched from the root's `onClick` is an implementation detail
            // and must not reach ancestors, which already receive the original click.
            onClick: (event: MouseEvent) => event.stopPropagation(),
            onFocus: () => controlElement?.focus(),
          },
          inputProps,
        ]}
      />
    </CheckboxRootContext>
  );

  function onInputChange(event: Event & { currentTarget: HTMLInputElement }) {
    if (local.readOnly) {
      event.preventDefault();
      return;
    }

    const nextChecked = event.currentTarget.checked;
    const details = createChangeEventDetails(REASONS.none, event);

    local.onCheckedChange?.(nextChecked, details);

    if (details.isCanceled) {
      return;
    }

    groupOnChange()?.(nextChecked, details);

    if (details.isCanceled) {
      return;
    }

    setCheckedState(nextChecked);

    const currentValue = value();
    if (currentValue !== undefined && groupContext !== undefined && !local.parent && !isGroupedWithParent()) {
      const nextGroupValue = nextChecked
        ? [...groupContext.value(), currentValue]
        : groupContext.value().filter((item) => item !== currentValue);

      groupContext.setValue(nextGroupValue, details);
    }
  }
}

const defaultProps = Object.freeze({
  as: "span",
  defaultChecked: false,
  disabled: false,
  indeterminate: false,
  nativeButton: false,
  parent: false,
  readOnly: false,
  required: false,
} satisfies Partial<CheckboxRoot.Props>);

export interface CheckboxRootState extends FieldRootState {
  /**
   * Whether the checkbox is currently ticked.
   */
  checked: Accessor<boolean>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   */
  readOnly: Accessor<boolean>;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   */
  required: Accessor<boolean>;
  /**
   * Whether the checkbox is in a mixed state — neither ticked, nor unticked.
   */
  indeterminate: Accessor<boolean>;
}

export interface CheckboxRootOwnProps {
  /**
   * The id of the input element.
   */
  id?: string | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   */
  form?: string | undefined;
  /**
   * Whether the checkbox is currently ticked.
   *
   * To render an uncontrolled checkbox, use the `defaultChecked` prop instead.
   */
  checked?: boolean | undefined;
  /**
   * Whether the checkbox is initially ticked.
   *
   * To render a controlled checkbox, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Event handler called when the checkbox is ticked or unticked.
   */
  onCheckedChange?: ((checked: boolean, eventDetails: CheckboxRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the checkbox is in a mixed state — neither ticked, nor unticked.
   * @default false
   */
  indeterminate?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?: ((element: HTMLInputElement) => void) | undefined;
  /**
   * Whether the checkbox controls a group of child checkboxes.
   *
   * Must be used in a Checkbox Group.
   * @default false
   */
  parent?: boolean | undefined;
  /**
   * The value submitted with the form when the checkbox is unchecked.
   */
  uncheckedValue?: string | undefined;
  /**
   * The checkbox's value. Identifies it within a Checkbox Group, falling back to `name` when omitted.
   */
  value?: string | undefined;
}

export type CheckboxRootProps<T extends ValidComponent = "span"> = CheckboxRootOwnProps &
  NativeButtonProps &
  Omit<RebaseUIComponentProps<T, CheckboxRootState>, "onChange" | "value">;

export type CheckboxRootChangeEventReason = typeof REASONS.none;

export type CheckboxRootChangeEventDetails = RebaseUIChangeEventDetails<CheckboxRoot.ChangeEventReason>;

export namespace CheckboxRoot {
  export type State = CheckboxRootState;
  export type Props<T extends ValidComponent = "span"> = CheckboxRootProps<T>;
  export type OwnProps = CheckboxRootOwnProps;
  export type ChangeEventReason = CheckboxRootChangeEventReason;
  export type ChangeEventDetails = CheckboxRootChangeEventDetails;
}
