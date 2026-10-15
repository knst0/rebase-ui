import { dynamicElement, effect, omitProps, untrack, type JSX } from "reze-js";

import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { createRegisterFieldControl } from "../../internals/field-register-control";
import { createSetFieldFocused, useFieldRootContext } from "../../internals/field-root-context";
import { useFormContext } from "../../internals/form-context";
import { createLabelableId, useLabelableContext } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { RebaseUIComponentProps } from "../../internals/types";
import type { RebaseUIEvent } from "../../types";
import type { FieldRootState } from "../root/FieldRoot";

/**
 * The form control to label and validate.
 * Renders an `<input>` element.
 *
 * Documentation: [Rebase UI Field](https://rebase-ui.knst.dev/components/field)
 */
export function FieldControl<T extends JSX.ElementType = "input">(props: FieldControl.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "autoFocus",
    "defaultValue",
    "disabled",
    "id",
    "name",
    "onValueChange",
    "value",
    "aria-describedby",
    "aria-labelledby",
    "onChange",
    "onFocus",
    "onBlur",
    "onKeyDown",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const field = useFieldRootContext();
  const { clearErrors } = useFormContext();
  const { labelId } = useLabelableContext();

  function disabled(): boolean {
    return field.disabled() === true || props.disabled === true;
  }

  function name(): string | undefined {
    return field.name() ?? (props.name || undefined);
  }

  const selectors: FieldRootStateSelectors = { ...field.state, disabled };
  const { setTouched, setDirty, setFilled, setValidityData, validityData, validationMode, validation } = field;

  const id = createLabelableId({ id: () => props.id || undefined });

  let inputElement: HTMLElement | null = null;

  const setFocused = createSetFieldFocused(disabled, () => inputElement);

  function isControlled(): boolean {
    return props.value !== undefined;
  }

  function value(): string | undefined {
    return isControlled() ? String(props.value) : undefined;
  }

  function syncValueFromProps(valueProp: unknown, defaultValueProp: unknown): void {
    const element = validation.inputElement;
    const serializedValue = valueProp == null ? undefined : String(valueProp);
    if (serializedValue === undefined && element != null && defaultValueProp !== undefined && defaultValueProp !== null) {
      // A `defaultValue` binding never initializes the input in Reze, so the
      // uncontrolled default is applied imperatively. Assigning `defaultValue`
      // resets the displayed value only while the input is unedited, matching
      // the native semantics the Solid layer relies on.
      element.defaultValue = defaultValueProp as string;
    }
    const currentValue = serializedValue ?? element?.value;
    if (currentValue !== undefined) {
      setFilled(currentValue !== "");
    }
  }

  effect(() => {
    // `defaultValue` is tracked too: changing it updates the input's DOM value while the input
    // is unedited, so the filled state must resync. (There is no controlled/uncontrolled warning
    // to suppress in Solid, unlike upstream's `useControlled`.)
    const valueProp = props.value;
    const defaultValueProp = props.defaultValue;

    // Actions never subscribe: the sync below only writes, so the effect tracks
    // just the value and defaultValue props above.
    untrack(() => syncValueFromProps(valueProp, defaultValueProp));
  });

  const ref = mergeRefs(
    (element: HTMLElement | null) => {
      inputElement = element;
      validation.inputElement = element as HTMLInputElement | null;
      if (element !== null) {
        untrack(() => {
          // The sync effect above runs before the element mounts, so the initial
          // uncontrolled value is synced here instead.
          syncValueFromProps(props.value, props.defaultValue);
          // The registration effect also ran before mount and captured `undefined` as the
          // initial value of uncontrolled controls; capture the mounted value instead so
          // dirty tracking compares against what the user started with.
          if (props.value === undefined && validityData.initialValue === undefined) {
            setValidityData((draft) => {
              draft.initialValue = (element as HTMLInputElement).value;
            });
          }
        });
      }
    },
    props.ref as ((element: HTMLElement | null) => void) | undefined,
  );

  createRegisterFieldControl({
    controlElement: () => inputElement,
    id,
    value,
    getFormValue: () => validation.inputElement?.value,
    enabled: () => !disabled(),
    name: () => props.name || undefined,
  });

  const externalValidationProps: Record<string, any> = {};
  Object.defineProperty(externalValidationProps, "aria-describedby", {
    enumerable: true,
    configurable: true,
    get: () => props["aria-describedby"],
  });
  const validationProps = validation.getValidationProps(disabled, externalValidationProps);

  function handleChange(event: Event): void {
    makeEventPreventable(event as RebaseUIEvent<Event>);
    (props.onChange as unknown as ((event: Event) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<Event>).rebaseUIHandlerPrevented) {
      return;
    }

    const inputValue = (event.currentTarget as HTMLInputElement).value;
    props.onValueChange?.(inputValue, createChangeEventDetails(REASONS.none, event));

    setDirty(inputValue !== (validityData.initialValue ?? ""));
    setFilled(inputValue !== "");

    if (!event.defaultPrevented) {
      clearErrors(name());
      validation.change(inputValue);
    }
  }

  function handleFocus(event: FocusEvent): void {
    makeEventPreventable(event as RebaseUIEvent<FocusEvent>);
    (props.onFocus as unknown as ((event: FocusEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<FocusEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    setFocused(true);
  }

  function handleBlur(event: FocusEvent): void {
    makeEventPreventable(event as RebaseUIEvent<FocusEvent>);
    (props.onBlur as unknown as ((event: FocusEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<FocusEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    setTouched(true);
    setFocused(false);

    if (validationMode === "onBlur") {
      void validation.commit((event.currentTarget as HTMLInputElement).value);
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    makeEventPreventable(event as RebaseUIEvent<KeyboardEvent>);
    (props.onKeyDown as unknown as ((event: KeyboardEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<KeyboardEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    if ((event.currentTarget as HTMLElement).tagName === "INPUT" && event.key === "Enter") {
      setTouched(true);
      void validation.commit((event.currentTarget as HTMLInputElement).value);
    }
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "input");

  function snapshot(): FieldControlState {
    return getFieldStateSnapshot(selectors);
  }

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would drop the
  // control's value, focus, and listeners every time the error appears or disappears. The
  // default path renders a static `<input>` so validation updates patch it in place; only a
  // customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <input
        {...(rest as Record<string, unknown>)}
        id={id()}
        bool:disabled={disabled()}
        name={name()}
        aria-labelledby={labelId()}
        aria-describedby={validationProps["aria-describedby"]}
        aria-invalid={validationProps["aria-invalid"]}
        autofocus={props.autoFocus}
        value={isControlled() ? (value() ?? "") : undefined}
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
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        ref={ref}
      >
        {resolveChildrenValue(children, snapshot)}
      </input>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={id()}
      bool:disabled={disabled()}
      name={name()}
      aria-labelledby={labelId()}
      aria-describedby={validationProps["aria-describedby"]}
      aria-invalid={validationProps["aria-invalid"]}
      autofocus={props.autoFocus}
      value={isControlled() ? (value() ?? "") : undefined}
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
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

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

export type FieldControlProps<T extends JSX.ElementType = "input"> = FieldControlOwnProps & RebaseUIComponentProps<T, FieldControlState>;

export type FieldControlChangeEventReason = typeof REASONS.none;

export type FieldControlChangeEventDetails = RebaseUIChangeEventDetails<FieldControl.ChangeEventReason>;

export namespace FieldControl {
  export type State = FieldControlState;
  export type Props<T extends JSX.ElementType = "input"> = FieldControlProps<T>;
  export type OwnProps = FieldControlOwnProps;
  export type ChangeEventReason = FieldControlChangeEventReason;
  export type ChangeEventDetails = FieldControlChangeEventDetails;
}
