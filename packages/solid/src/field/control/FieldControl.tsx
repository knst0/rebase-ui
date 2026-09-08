import type { ValidComponent } from "@solidjs/web";
import { createEffect, createMemo, untrack } from "solid-js";

import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { fieldValidityMapping } from "../../internals/field-constants";
import { createRegisterFieldControl } from "../../internals/field-register-control";
import { useFieldRootContext } from "../../internals/field-root-context";
import { useFormContext } from "../../internals/form-context";
import { createLabelableId, useLabelableContext } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { FieldRootState } from "../root/FieldRoot";

/**
 * The form control to label and validate.
 * Renders an `<input>` element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldControl<T extends ValidComponent = "input">(props: FieldControl.Props<T>) {
  const [local, elementProps] = split(props as FieldControl.Props, { default: defaultProps }, [
    "as",
    "autoFocus",
    "defaultValue",
    "disabled",
    "id",
    "name",
    "onValueChange",
    "value",
  ]);

  const as = untrack(() => local.as);

  const {
    state: fieldState,
    name: fieldName,
    disabled: fieldDisabled,
    setTouched,
    setDirty,
    validityData,
    setFocused,
    setFilled,
    validationMode,
    validation,
  } = useFieldRootContext();
  const { clearErrors } = useFormContext();

  const disabled = createMemo(() => fieldDisabled() === true || local.disabled === true);
  const name = createMemo(() => fieldName() ?? (local.name || undefined));

  const state: FieldControlState = { ...fieldState, disabled };

  const { labelId } = useLabelableContext();

  const id = createLabelableId({ id: () => local.id || undefined });

  let inputElement: HTMLElement | null = null;

  const ref = mergeRefs((element: HTMLElement) => {
    inputElement = element;
    validation.inputElement = element as HTMLInputElement;
  });

  createEffect(
    () => local.value,
    (valueProp) => {
      const hasExternalValue = valueProp != null;
      if (validation.inputElement?.value || (hasExternalValue && valueProp !== "")) {
        setFilled(true);
      } else if (hasExternalValue && valueProp === "") {
        setFilled(false);
      }
    },
  );

  createEffect(
    () => local.autoFocus,
    (autoFocus) => {
      if (autoFocus && inputElement != null && inputElement.ownerDocument.activeElement === inputElement) {
        setFocused(true);
      }
    },
  );

  const isControlled = () => local.value !== undefined;
  const value = () => (isControlled() ? String(local.value) : undefined);

  const getValueFromInput = () => validation.inputElement?.value;

  createRegisterFieldControl({
    controlElement: () => inputElement,
    id,
    value,
    getFormValue: getValueFromInput,
    enabled: () => !disabled(),
    name: () => local.name || undefined,
  });

  const controlProps = (externalProps: Record<string, any>) => {
    const target: Record<string, any> = {};

    for (const key in externalProps) {
      if (key === "onChange" || key === "onFocus" || key === "onBlur" || key === "onKeyDown") {
        continue;
      }
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => externalProps[key] });
    }

    Object.defineProperty(target, "id", { enumerable: true, configurable: true, get: () => id() });
    Object.defineProperty(target, "disabled", { enumerable: true, configurable: true, get: () => disabled() });
    Object.defineProperty(target, "name", { enumerable: true, configurable: true, get: () => name() });
    Object.defineProperty(target, "aria-labelledby", { enumerable: true, configurable: true, get: () => labelId() });
    target.autofocus = local.autoFocus;

    if (isControlled()) {
      Object.defineProperty(target, "value", { enumerable: true, configurable: true, get: () => value() ?? "" });
    } else if (!("value" in externalProps)) {
      Object.defineProperty(target, "defaultValue", {
        enumerable: true,
        configurable: true,
        get: () => local.defaultValue,
      });
    }

    chainHandler("onChange", (event) => {
      const inputValue = (event.currentTarget as HTMLInputElement).value;
      local.onValueChange?.(inputValue, createChangeEventDetails(REASONS.none, event));

      setDirty(inputValue !== (validityData.initialValue ?? ""));
      setFilled(inputValue !== "");

      if (!event.defaultPrevented) {
        clearErrors(name());
        validation.change(inputValue);
      }
    });

    chainHandler("onFocus", () => {
      setFocused(true);
    });

    chainHandler("onBlur", (event) => {
      setTouched(true);
      setFocused(false);

      if (validationMode === "onBlur") {
        void validation.commit(event.currentTarget.value);
      }
    });

    chainHandler("onKeyDown", (event) => {
      if (event.currentTarget.tagName === "INPUT" && event.key === "Enter") {
        setTouched(true);
        void validation.commit(event.currentTarget.value);
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

    return validation.getValidationProps(disabled(), target);
  };

  return (
    <RenderElement as={as} state={state} props={[elementProps, controlProps, { ref }]} stateAttributesMapping={fieldValidityMapping} />
  );
}

const defaultProps = Object.freeze({
  as: "input",
  autoFocus: false,
  disabled: false,
} satisfies Partial<FieldControl.Props>);

export interface FieldControlState extends FieldRootState {}

export interface FieldControlOwnProps {
  /**
   * Automatically focus the control when it is mounted.
   * @default false
   */
  autoFocus?: boolean | undefined;
  /**
   * Callback fired when the `value` changes. Use when controlled.
   */
  onValueChange?: ((value: string, eventDetails: FieldControl.ChangeEventDetails) => void) | undefined;
  /**
   * The uncontrolled initial value of the control.
   */
  defaultValue?: string | number | readonly string[] | undefined;
}

export type FieldControlProps<T extends ValidComponent = "input"> = FieldControlOwnProps & RebaseUIComponentProps<T, FieldControlState>;

export type FieldControlChangeEventReason = typeof REASONS.none;

export type FieldControlChangeEventDetails = RebaseUIChangeEventDetails<FieldControl.ChangeEventReason>;

export namespace FieldControl {
  export type State = FieldControlState;
  export type Props<T extends ValidComponent = "input"> = FieldControlProps<T>;
  export type OwnProps = FieldControlOwnProps;
  export type ChangeEventReason = FieldControlChangeEventReason;
  export type ChangeEventDetails = FieldControlChangeEventDetails;
}
