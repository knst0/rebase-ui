import type { ValidComponent } from "@solidjs/web";
import { type Accessor, createEffect, createMemo, createSignal, createUniqueId, onCleanup, onSettled, untrack } from "solid-js";

import { dispatchClickWithModifiers } from "#utils/dispatchClickWithModifiers";
import { serializeValue } from "#utils/serializeValue";
import { visuallyHidden, visuallyHiddenInput } from "#utils/visuallyHidden";

import { useFieldItemContext } from "../../field/item/FieldItemContext";
import type { FieldRootState } from "../../field/root/FieldRoot";
import { ACTIVE_COMPOSITE_ITEM, useCompositeItem } from "../../internals/composite";
import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { useFieldRootContext } from "../../internals/field-root-context";
import { createAriaLabelledBy, createLabelableId, useLabelableContext } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { useRadioGroupContext } from "../../radio-group/RadioGroupContext";
import { stateAttributesMapping } from "../utils/stateAttributesMapping";
import { RadioRootContext } from "./RadioRootContext";

/**
 * Represents the radio button itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Rebase UI Radio](https://rebase-ui.knst.dev/components/radio)
 */
export function RadioRoot<Value, T extends ValidComponent = "span">(props: RadioRoot.Props<Value, T>) {
  const [local, elementProps] = split(props as RadioRoot.Props<Value>, { default: defaultProps }, [
    "as",
    "aria-labelledby",
    "disabled",
    "id",
    "inputRef",
    "nativeButton",
    "readOnly",
    "required",
    "value",
  ]);

  const as = untrack(() => local.as);
  const nativeButton = untrack(() => local.nativeButton);

  const groupContext = useRadioGroupContext();

  const {
    setTouched: setFieldTouched,
    setFilled,
    state: fieldState,
    disabled: fieldDisabled,
    validation: fieldValidation,
  } = useFieldRootContext();
  const { disabled: itemDisabled } = useFieldItemContext();
  const { labelId, getDescriptionProps } = useLabelableContext();

  const disabled = createMemo(
    () => fieldDisabled() === true || itemDisabled() === true || groupContext?.disabled() === true || local.disabled === true,
  );
  const readOnly = () => groupContext?.readOnly() === true || local.readOnly === true;
  const required = () => groupContext?.required() === true || local.required === true;
  const form = groupContext?.form;
  const name = () => groupContext?.name;

  const checked = () => (groupContext ? groupContext.checkedValue() === local.value : (local.value as unknown) === "");

  let radioElement: HTMLElement | null = null;
  let inputElement: HTMLInputElement | null = null;
  const [labelSource, setLabelSource] = createSignal<HTMLInputElement | null>(null);

  const validation = groupContext?.validation ?? fieldValidation;

  const registerInput = (element: HTMLInputElement) =>
    validation.registerInput(element, {
      get controlElement() {
        return radioElement;
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

  onSettled(() => {
    if (inputElement?.checked) {
      setFilled(true);
    }
  });

  let detachGroupInput: void | (() => void) | undefined;
  createEffect(
    () => ({ isChecked: checked(), isDisabled: disabled() }),
    ({ isChecked, isDisabled }) => {
      const register = groupContext?.registerInputRef;
      if (!register || !inputElement) {
        return;
      }

      if (isDisabled && isChecked) {
        register(null);
        return;
      }

      detachGroupInput = register(inputElement) ?? undefined;
    },
  );

  onCleanup(() => {
    detachGroupInput?.();
  });

  const generatedId = createUniqueId();
  const controlId = createLabelableId({ id: () => local.id || undefined });
  const rootId = () => (nativeButton ? controlId() : generatedId);
  const hiddenInputId = () => (nativeButton ? undefined : controlId());

  const ariaLabelledBy = createAriaLabelledBy({
    ariaLabelledBy: () => local["aria-labelledby"] as string | undefined,
    labelId,
    labelSource,
    enableFallback: () => !nativeButton,
    labelSourceId: controlId,
  });

  const { getButtonProps, buttonRef } = createButton({
    disabled,
    native: () => nativeButton,
    composite: false,
  });

  const composite = useCompositeItem({
    metadata: () => ({
      get disabled() {
        return disabled();
      },
    }),
  });

  const state: RadioRootState = {
    ...fieldState,
    checked,
    disabled,
    readOnly,
    required,
  };

  const rootProps = {
    role: "radio" as const,
    get "aria-checked"(): "true" | "false" {
      return checked() ? "true" : "false";
    },
    get "aria-labelledby"() {
      return ariaLabelledBy();
    },
    get [ACTIVE_COMPOSITE_ITEM](): "" | undefined {
      return checked() ? "" : undefined;
    },
    get id() {
      return rootId();
    },
  };

  const rootHandlers = (externalProps: Record<string, any>) => {
    const target: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "onKeyDown" || key === "onClick" || key === "onFocus") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    chainHandler("onKeyDown", (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        // Radio only activates with Space. Preventing the keydown's default
        // stops the button behavior from turning Enter into a click.
        event.preventDefault();
      }
    });

    chainHandler("onClick", (event: MouseEvent) => {
      if (event.defaultPrevented || disabled() || readOnly()) {
        return;
      }

      event.preventDefault();

      if (!inputElement) {
        return;
      }

      dispatchClickWithModifiers(inputElement, event);
    });

    chainHandler("onFocus", (event: FocusEvent) => {
      if (event.defaultPrevented || disabled() || readOnly() || !groupContext?.touched()) {
        return;
      }

      inputElement?.click();

      groupContext?.setTouched(false);
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

  const ref = mergeRefs(buttonRef, composite?.compositeRef, (element: HTMLElement) => {
    radioElement = element;
  });

  const validationProps = (externalProps: Record<string, any>) =>
    validation.getValidationProps(disabled(), getDescriptionProps(externalProps));

  const rootSources = [
    rootProps,
    elementProps,
    rootHandlers,
    getButtonProps,
    getDescriptionProps,
    validationProps,
    composite?.getCompositeProps,
    { ref },
  ];

  const inputProps = {
    ref: mergedInputRef,
    type: "radio" as const,
    "aria-hidden": "true" as const,
    tabindex: -1,
    get checked() {
      return checked();
    },
    get disabled() {
      return disabled();
    },
    get form() {
      return form;
    },
    get id() {
      return hiddenInputId();
    },
    get name() {
      return name();
    },
    get required() {
      return required();
    },
    get readOnly() {
      return readOnly();
    },
    get value() {
      const value = local.value;
      return value === undefined ? undefined : serializeValue(value);
    },
    get style() {
      return name() ? visuallyHiddenInput : visuallyHidden;
    },
    onChange: onInputChange,
    // Clicks dispatched on the input from the root's `onClick` and `onFocus` are an
    // implementation detail and must not reach ancestors.
    onClick: (event: MouseEvent) => event.stopPropagation(),
    onFocus: () => radioElement?.focus(),
  };

  return (
    <RadioRootContext value={state}>
      <RenderElement as={as} state={state} props={rootSources} stateAttributesMapping={stateAttributesMapping} />
      <RenderElement as="input" props={[inputProps]} />
    </RadioRootContext>
  );

  function onInputChange(event: Event & { currentTarget: HTMLInputElement }) {
    event.currentTarget.checked = untrack(checked);
    if (disabled() || readOnly() || local.value === undefined) {
      return;
    }

    const details = createChangeEventDetails(REASONS.none, event);

    groupContext?.setCheckedValue(local.value, details);

    if (details.isCanceled) {
      return;
    }

    setFieldTouched(true);
  }
}

const defaultProps = Object.freeze({
  as: "span",
  disabled: false,
  nativeButton: false,
  readOnly: false,
  required: false,
} satisfies Partial<RadioRoot.Props<any>>);

export interface RadioRootState extends FieldRootState {
  /**
   * Whether the radio button is currently selected.
   */
  checked: Accessor<boolean>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly: Accessor<boolean>;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required: Accessor<boolean>;
}

export interface RadioRootOwnProps<Value = any> extends NonNativeButtonProps {
  /**
   * The unique identifying value of the radio in a group.
   */
  value: Value;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to select the radio button.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: ((element: HTMLInputElement) => void) | undefined;
}

export type RadioRootProps<Value = any, T extends ValidComponent = "span"> = RadioRootOwnProps<Value> &
  Omit<RebaseUIComponentProps<T, RadioRootState>, "value">;

export namespace RadioRoot {
  export type State = RadioRootState;
  export type Props<Value = any, T extends ValidComponent = "span"> = RadioRootProps<Value, T>;
  export type OwnProps<Value = any> = RadioRootOwnProps<Value>;
}
