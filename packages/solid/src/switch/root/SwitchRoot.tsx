import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createSignal, createUniqueId, untrack } from "solid-js";

import { dispatchClickWithModifiers } from "#utils/dispatchClickWithModifiers";
import { getDefaultFormSubmitter } from "#utils/getDefaultFormSubmitter";
import { ownerWindow } from "#utils/owner";
import { visuallyHidden, visuallyHiddenInput } from "#utils/visuallyHidden";

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
import type { NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { stateAttributesMapping } from "../stateAttributesMapping";
import { SwitchRootContext } from "./SwitchRootContext";

export function SwitchRoot<T extends ValidComponent = "span">(props: SwitchRoot.Props<T>) {
  const [local, elementProps] = split(props as SwitchRoot.Props, { default: defaultProps }, [
    "as",
    "aria-labelledby",
    "checked",
    "defaultChecked",
    "disabled",
    "id",
    "inputRef",
    "name",
    "nativeButton",
    "onCheckedChange",
    "readOnly",
    "required",
    "uncheckedValue",
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
  const { labelId, getDescriptionProps } = useLabelableContext();

  const disabled = createMemo(() => rootDisabled() === true || itemDisabled() || local.disabled === true);
  const name = () => fieldName() ?? local.name;

  const generatedId = createUniqueId();
  const controlId = createLabelableId({ id: () => local.id || undefined });
  const rootId = () => (nativeButton ? controlId() : generatedId);

  const validation = localValidation;

  const [checked, setCheckedState] = createControllableSignal<boolean>({
    value: () => local.checked,
    defaultValue: () => local.defaultChecked,
  });

  const computedChecked = () => checked() ?? false;

  let controlElement: HTMLElement | null = null;
  let inputElement: HTMLInputElement | null = null;
  const [labelSource, setLabelSource] = createSignal<HTMLInputElement | null>(null);

  const { getButtonProps, buttonRef } = createButton({ disabled, native: () => nativeButton });

  createRegisterFieldControl({
    controlElement: () => controlElement,
    id: () => generatedId,
    value: checked,
    enabled: () => !disabled(),
    name: () => local.name,
  });

  const registerInput = (element: HTMLInputElement) =>
    validation.registerInput(element, {
      get controlElement() {
        return controlElement;
      },
      value: undefined,
    });

  const mergedInputRef = mergeRefs(
    local.inputRef,
    (element: HTMLInputElement) => {
      inputElement = element;
      setLabelSource(element);
    },
    registerInput,
  );

  const ariaLabelledBy = createAriaLabelledBy({
    ariaLabelledBy: () => local["aria-labelledby"] as string | undefined,
    labelId,
    labelSource,
    enableFallback: () => !nativeButton,
    labelSourceId: controlId,
  });

  createEffect(
    () => checked() ?? false,
    (isChecked) => {
      setFilled(isChecked);
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

      form.clearErrors(name());
      setDirty(isChecked !== validityData.initialValue);

      validation.change(isChecked);
    },
  );

  const state: SwitchRootState = {
    ...fieldState,
    checked: computedChecked,
    disabled,
    readOnly: () => local.readOnly,
    required: () => local.required,
  };

  const rootProps = {
    get id() {
      return rootId();
    },
    role: "switch" as const,
    get "aria-checked"(): "true" | "false" {
      return computedChecked() ? "true" : "false";
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
  };

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
        void validation.commit(inputElement.checked);
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

  const inputProps = (externalProps: Record<string, any>) => validation.getValidationProps(disabled(), getDescriptionProps(externalProps));

  return (
    <SwitchRootContext value={state}>
      <RenderElement
        as={as}
        state={state}
        stateAttributesMapping={stateAttributesMapping}
        props={[rootProps, elementProps, rootHandlers, getButtonProps, getDescriptionProps, { ref }]}
      />
      {!computedChecked() && name() && local.uncheckedValue !== undefined && (
        <input type="hidden" name={name()} value={local.uncheckedValue} disabled={disabled()} />
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
            get name() {
              return name();
            },
            get id() {
              return nativeButton ? undefined : controlId();
            },
            get required() {
              return local.required;
            },
            get style() {
              return name() ? visuallyHiddenInput : visuallyHidden;
            },
            onChange: onInputChange,
            onClick: (event: MouseEvent) => event.stopPropagation(),
            onFocus: () => controlElement?.focus(),
          },
          inputProps,
        ]}
      />
    </SwitchRootContext>
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

    setCheckedState(nextChecked);
  }
}

const defaultProps = Object.freeze({
  as: "span",
  defaultChecked: false,
  disabled: false,
  nativeButton: false,
  readOnly: false,
  required: false,
} satisfies Partial<SwitchRoot.Props>);

export interface SwitchRootState extends FieldRootState {
  checked: Accessor<boolean>;
  disabled: Accessor<boolean>;
  readOnly: Accessor<boolean>;
  required: Accessor<boolean>;
}

export interface SwitchRootOwnProps extends NonNativeButtonProps {
  /**
   * The id of the hidden input element.
   *
   * When `nativeButton` is `true`, the id is applied to the root element.
   */
  id?: string | undefined;
  /**
   * Whether the switch is currently active.
   *
   * To render an uncontrolled switch, use the `defaultChecked` prop instead.
   */
  checked?: boolean | undefined;
  /**
   * Whether the switch is initially active.
   *
   * To render a controlled switch, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?: ((element: HTMLInputElement) => void) | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the switch is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Event handler called when the switch is activated or deactivated.
   */
  onCheckedChange?: ((checked: boolean, eventDetails: SwitchRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must activate the switch before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * The value submitted with the form when the switch is on.
   * By default, switch submits the "on" value, matching native checkbox behavior.
   */
  value?: string | undefined;
  /**
   * The value submitted with the form when the switch is off.
   * By default, unchecked switches do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
}

export type SwitchRootProps<T extends ValidComponent = "span"> = SwitchRootOwnProps &
  Omit<RebaseUIComponentProps<T, SwitchRootState>, "onChange">;

export type SwitchRootChangeEventReason = typeof REASONS.none;
export type SwitchRootChangeEventDetails = RebaseUIChangeEventDetails<SwitchRoot.ChangeEventReason>;

export namespace SwitchRoot {
  export type State = SwitchRootState;
  export type Props<T extends ValidComponent = "span"> = SwitchRootProps<T>;
  export type OwnProps = SwitchRootOwnProps;
  export type ChangeEventReason = SwitchRootChangeEventReason;
  export type ChangeEventDetails = SwitchRootChangeEventDetails;
}
