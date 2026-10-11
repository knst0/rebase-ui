import { serializeValue } from "@rebase-ui/core/serializeValue";
import {
  createUniqueId,
  dynamicElement,
  effect,
  getOwner,
  omitProps,
  onCleanup,
  runWithOwner,
  store,
  untrack,
  type JSX,
} from "reze-js";

import { isEligibleInput } from "../field/root/createFieldValidation";
import type { FieldRootState } from "../field/root/FieldRoot";
import { useFieldsetRootContext } from "../fieldset/root/FieldsetRootContext";
import { createControllableSignal } from "../internals/createControllableSignal";
import { REASONS, type RebaseUIChangeEventDetails } from "../internals/event-details";
import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../internals/field-constants";
import { createRegisterFieldControl } from "../internals/field-register-control";
import { useFieldRootContext } from "../internals/field-root-context";
import { useFormContext } from "../internals/form-context";
import { createLabelableId, useLabelableContext } from "../internals/labelable-provider";
import { makeEventPreventable } from "../internals/makeEventPreventable";
import { mergeRefs } from "../internals/mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../internals/renderProps";
import type { ButtonEventHandlers, ChildrenValue, RebaseUIComponentProps } from "../internals/types";
import type { RebaseUIEvent } from "../types";
import { RadioGroupContext, useRadioGroupContext } from "./RadioGroupContext";

/**
 * Provides a shared state to a series of radio buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Rebase UI Radio](https://rebase-ui.knst.dev/components/radio)
 */
export function RadioGroup<Value, T extends JSX.ElementType = "div">(props: RadioGroup.Props<Value, T>) {
  const rest = omitProps(
    props,
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
    "onBlur",
    "onKeyDown",
    "aria-required",
    "aria-disabled",
    "aria-readonly",
    "aria-labelledby",
    "aria-invalid",
    "class",
    "style",
    "children",
    "ref",
  );

  const field = useFieldRootContext();
  const { labelId } = useLabelableContext();
  const form = useFormContext();
  const { clearErrors } = form;
  const fieldsetContext = useFieldsetRootContext(true);

  function disabled(): boolean {
    return field.disabled() === true || props.disabled === true;
  }

  function name(): string | undefined {
    return field.name() ?? props.name;
  }

  function readOnly(): boolean {
    return props.readOnly === true;
  }

  function required(): boolean {
    return props.required === true;
  }

  const [checkedValue, setCheckedValueUnwrapped] = createControllableSignal<Value>({
    value: () => props.value,
    defaultValue: () => props.defaultValue as Value,
  });

  const groupStore = store({ touched: false });

  function touched(): boolean {
    return groupStore.touched;
  }

  function setTouched(next: boolean): void {
    groupStore.touched = next;
  }

  let groupInputRef: HTMLInputElement | null = null;
  let firstEnabledInputRef: HTMLInputElement | null = null;
  let currentInputRef = untrack(() => props.inputRef);
  let lastAppliedInputRef = currentInputRef;

  function setCheckedValue(value: Value, eventDetails: RadioGroup.ChangeEventDetails): void {
    // Activation unchecks the previous native radio before change fires.
    // Restore it until the proposed value is accepted and projected.
    const currentValue = untrack(checkedValue);
    if (groupInputRef) {
      groupInputRef.checked = currentValue !== undefined && groupInputRef.value === serializeValue(currentValue);
    }

    props.onValueChange?.(value, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setCheckedValueUnwrapped(value);
  }

  // Only forwards the public `inputRef` and tracks the current representative for that forwarding.
  // The registry (`validation.registeredInputs`) is authoritative for validation and form-value
  // projection, so the group must not write `validation.inputRef`: a stale, unmounted radio left
  // there would become the Field's fallback once the registry empties and keep blocking submission.
  function setInputRef(hiddenInput: HTMLInputElement | null): void {
    if (groupInputRef === hiddenInput && lastAppliedInputRef === currentInputRef) {
      return;
    }

    lastAppliedInputRef = currentInputRef;
    groupInputRef = hiddenInput;
    currentInputRef?.(hiddenInput);
  }

  // Re-apply the current representative input when the `inputRef` prop identity changes.
  // Unlike React's ref cleanup, the previous callback is never invoked with `null`: it
  // simply stops receiving updates while the new one takes over the current input.
  effect(() => {
    const inputRef = props.inputRef;

    // Actions never subscribe: the forwarding below only writes, so the effect tracks
    // just the `inputRef` prop above.
    untrack(() => {
      currentInputRef = inputRef ?? undefined;
      setInputRef(groupInputRef);
    });
  });

  function registerInputRef(input: HTMLInputElement | null, isChecked = false): void | (() => void) {
    if (!input) {
      return undefined;
    }

    if (!input.disabled) {
      if (!firstEnabledInputRef) {
        firstEnabledInputRef = input;
      }

      const currentInput = groupInputRef;
      // The reactive checked state decides, not the input's `checked` property: the
      // re-registration runs on the state change while the property binding applies later.
      if (isChecked || currentInput == null || currentInput.disabled) {
        setInputRef(input);
      }
    }

    // Detach when this input unmounts while still forwarded, so consumers don't
    // keep holding a disconnected node. The input may have become the forwarded
    // one after attach (via the re-registration effect), so always return this.
    return () => {
      if (firstEnabledInputRef === input) {
        firstEnabledInputRef = null;
      }
      if (groupInputRef === input) {
        setInputRef(null);
      }
    };
  }

  const { validation } = field;

  function getFormValue(): Value | null {
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
  }

  // The group is the field's control and takes its name from `aria-labelledby`, so `Field.Label`
  // must not point `for` at the group element itself.
  createLabelableId({ id: () => null });

  const generatedId = createUniqueId();

  createRegisterFieldControl({
    controlElement: () => validation.getInputControl(),
    id: () => generatedId,
    value: checkedValue as () => unknown,
    getFormValue,
    enabled: () => !!field.name() && !disabled(),
    name: field.name,
  });

  effect(() => {
    const filled = checkedValue() != null;

    // Actions never subscribe: the write below only publishes, so the effect tracks
    // just the checked value above.
    untrack(() => {
      field.setFilled(filled);
    });
  });

  let valueChanged = false;
  effect(() => {
    const next = checkedValue();

    // Actions never subscribe: the sync below only writes, so the effect tracks
    // just the checked value above.
    untrack(() => {
      if (!valueChanged) {
        valueChanged = true;
        return;
      }

      const fieldName = field.name();
      if (fieldName) {
        clearErrors(fieldName);
      }

      field.setDirty(next !== field.validityData.initialValue);
      validation.change(next);

      const fallbackInput = firstEnabledInputRef;
      if (next == null && fallbackInput && !fallbackInput.disabled) {
        setInputRef(fallbackInput);
      }
    });
  });

  const selectors: FieldRootStateSelectors = { ...field.state, disabled };

  function snapshot(): RadioGroupState {
    return { ...getFieldStateSnapshot(selectors), readOnly: readOnly(), required: required() };
  }

  const externalValidationProps: Record<string, any> = {};
  Object.defineProperty(externalValidationProps, "aria-describedby", {
    enumerable: true,
    configurable: true,
    get: () => props["aria-describedby"],
  });
  const validationProps = validation.getValidationProps(disabled, externalValidationProps);

  let groupElement: HTMLElement | null = null;
  const itemsStore = store({ version: 0 });

  function getGroupElement(): HTMLElement | null {
    return groupElement;
  }

  function itemsVersion(): number {
    return itemsStore.version;
  }

  function registerItem(): () => void {
    itemsStore.version += 1;
    return () => {
      itemsStore.version += 1;
    };
  }

  const contextValue: RadioGroupContext = {
    checkedValue: checkedValue as () => any,
    disabled,
    form: untrack(() => props.form),
    validation,
    name: untrack(name),
    readOnly,
    registerInputRef,
    required,
    setCheckedValue: setCheckedValue as RadioGroupContext["setCheckedValue"],
    setTouched,
    touched,
    getGroupElement,
    itemsVersion,
    registerItem,
  };

  function handleKeyDown(event: KeyboardEvent): void {
    makeEventPreventable(event as RebaseUIEvent<KeyboardEvent>);
    (props.onKeyDown as unknown as ((event: KeyboardEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<KeyboardEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    if (event.defaultPrevented) {
      return;
    }

    const key = event.key;
    const isArrow = key === "ArrowRight" || key === "ArrowLeft" || key === "ArrowDown" || key === "ArrowUp";
    if (!isArrow) {
      return;
    }

    // Shift is an allowed modifier; any other modifier leaves the key to the user agent.
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    const group = groupElement;
    const target = event.target as Element | null;
    if (!group || !target || !(target instanceof Element) || !group.contains(target)) {
      return;
    }

    const current = target.closest('[role="radio"]');
    if (!current || !group.contains(current) || current.closest('[role="radiogroup"]') !== group) {
      return;
    }

    const radios = [...group.querySelectorAll('[role="radio"]')].filter(
      (element) => element.closest('[role="radiogroup"]') === group && !element.hasAttribute("data-disabled"),
    );
    if (radios.length === 0) {
      return;
    }

    const dir =
      group.closest("[dir]")?.getAttribute("dir") ?? group.ownerDocument?.documentElement.getAttribute("dir");
    const isRtl = dir === "rtl";
    const forwardKey = isRtl ? "ArrowLeft" : "ArrowRight";
    const backwardKey = isRtl ? "ArrowRight" : "ArrowLeft";
    const delta = key === "ArrowDown" || key === forwardKey ? 1 : key === "ArrowUp" || key === backwardKey ? -1 : 0;
    if (delta === 0) {
      return;
    }

    event.preventDefault();

    // The group marks itself touched before the newly focused radio receives focus,
    // so it can select itself on focus.
    setTouched(true);

    const currentIndex = radios.indexOf(current);
    const nextIndex =
      currentIndex === -1
        ? delta > 0
          ? 0
          : radios.length - 1
        : (currentIndex + delta + radios.length) % radios.length;
    (radios[nextIndex] as HTMLElement).focus();
  }

  function handleFocusOut(event: FocusEvent): void {
    const currentTarget = event.currentTarget as HTMLElement | null;
    const relatedTarget = event.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    makeEventPreventable(event as RebaseUIEvent<FocusEvent>);
    (props.onBlur as unknown as ((event: FocusEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<FocusEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    setTouched(false);
    field.setTouched(true);
    field.setFocused(false);

    if (field.validationMode === "onBlur") {
      void validation.commit(checkedValue());
    }
  }

  const ref = mergeRefs((element: HTMLElement | null) => {
    if (groupElement && element !== groupElement) {
      groupElement.removeEventListener("focusout", handleFocusOut);
    }
    groupElement = element;
    if (element) {
      element.addEventListener("focusout", handleFocusOut);
    }
  }, props.ref as ((element: HTMLElement | null) => void) | undefined);

  onCleanup(() => {
    groupElement?.removeEventListener("focusout", handleFocusOut);
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "div");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts, which would drop the radios' focus and listeners. The default path renders a
  // static `<div>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  // The provider lives inside the tag: context does not flow through dynamicElement,
  // so providing above it would leave the radio parts without context. Children
  // resolve in RadioGroupContent below so they are created inside the provider.
  if (props.as == null) {
    return (
      <div
        {...(rest as Record<string, unknown>)}
        id={props.id}
        role="radiogroup"
        aria-required={required() ? "true" : undefined}
        aria-disabled={disabled() ? "true" : undefined}
        aria-readonly={readOnly() ? "true" : undefined}
        aria-labelledby={labelId() ?? fieldsetContext?.legendId()}
        aria-describedby={validationProps["aria-describedby"]}
        aria-invalid={validationProps["aria-invalid"]}
        data-disabled={disabled() ? "" : undefined}
        data-readonly={readOnly() ? "" : undefined}
        data-required={required() ? "" : undefined}
        data-valid={selectors.valid() === true ? "" : undefined}
        data-invalid={selectors.valid() === false ? "" : undefined}
        data-touched={selectors.touched() ? "" : undefined}
        data-dirty={selectors.dirty() ? "" : undefined}
        data-filled={selectors.filled() ? "" : undefined}
        data-focused={selectors.focused() ? "" : undefined}
        data-validating={selectors.validating() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onKeyDown={handleKeyDown}
        ref={ref}
      >
        <RadioGroupContext value={contextValue}>
          <RadioGroupContent>{props.children}</RadioGroupContent>
        </RadioGroupContext>
      </div>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={props.id}
      role="radiogroup"
      aria-required={required() ? "true" : undefined}
      aria-disabled={disabled() ? "true" : undefined}
      aria-readonly={readOnly() ? "true" : undefined}
      aria-labelledby={labelId() ?? fieldsetContext?.legendId()}
      aria-describedby={validationProps["aria-describedby"]}
      aria-invalid={validationProps["aria-invalid"]}
      data-disabled={disabled() ? "" : undefined}
      data-readonly={readOnly() ? "" : undefined}
      data-required={required() ? "" : undefined}
      data-valid={selectors.valid() === true ? "" : undefined}
      data-invalid={selectors.valid() === false ? "" : undefined}
      data-touched={selectors.touched() ? "" : undefined}
      data-dirty={selectors.dirty() ? "" : undefined}
      data-filled={selectors.filled() ? "" : undefined}
      data-focused={selectors.focused() ? "" : undefined}
      data-validating={selectors.validating() ? "" : undefined}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      onKeyDown={handleKeyDown}
      ref={ref}
    >
      <RadioGroupContext value={contextValue}>
        <RadioGroupContent>{props.children}</RadioGroupContent>
      </RadioGroupContext>
    </Tag>
  );
}

/**
 * Resolves the group children inside the radio group context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the group state changes, matching the Solid layer where the
 * children memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function RadioGroupContent(props: { children: ChildrenValue<RadioGroupState> }) {
  const children = props.children;

  const field = useFieldRootContext();
  const group = useRadioGroupContext();

  function snapshot(): RadioGroupState {
    return {
      ...getFieldStateSnapshot({ ...field.state, disabled: group?.disabled ?? field.state.disabled }),
      readOnly: group?.readOnly() ?? false,
      required: group?.required() ?? false,
    };
  }

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: RadioGroupState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the group context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const state = snapshot();

      return runWithOwner(owner, () => render(state));
    };
  }

  return children as JSX.Element;
}

export interface RadioGroupState extends FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to select a different radio button in the group.
   */
  readOnly: boolean;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required: boolean;
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

export type RadioGroupProps<Value = any, T extends JSX.ElementType = "div"> = RadioGroupOwnProps<Value> &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, RadioGroupState>;

export type RadioGroupChangeEventReason = typeof REASONS.none;

export type RadioGroupChangeEventDetails = RebaseUIChangeEventDetails<RadioGroup.ChangeEventReason>;

export namespace RadioGroup {
  export type State = RadioGroupState;
  export type Props<Value = any, T extends JSX.ElementType = "div"> = RadioGroupProps<Value, T>;
  export type OwnProps<Value = any> = RadioGroupOwnProps<Value>;
  export type ChangeEventReason = RadioGroupChangeEventReason;
  export type ChangeEventDetails = RadioGroupChangeEventDetails;
}
