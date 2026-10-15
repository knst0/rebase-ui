import { createUniqueId, dynamicElement, effect, getOwner, omitProps, onCleanup, runWithOwner, store, untrack, type JSX } from "reze-js";

import { useCheckboxGroupContext } from "../../checkbox-group/CheckboxGroupContext";
import { useFieldItemContext } from "../../field/item/FieldItemContext";
import type { FieldRootState } from "../../field/root/FieldRoot";
import { createButton } from "../../internals/create-button";
import { createControllableSignal } from "../../internals/createControllableSignal";
import { dispatchClickWithModifiers } from "../../internals/dispatchClickWithModifiers";
import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { getFieldStateSnapshot } from "../../internals/field-constants";
import { createRegisterFieldControl } from "../../internals/field-register-control";
import { createSetFieldFocused, useFieldRootContext } from "../../internals/field-root-context";
import { useFormContext } from "../../internals/form-context";
import { getDefaultFormSubmitter } from "../../internals/getDefaultFormSubmitter";
import { createAriaLabelledBy, createLabelableId, useLabelableContext } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, ChildrenValue, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { visuallyHidden, visuallyHiddenInput } from "../../internals/utils/visuallyHidden";
import type { RebaseUIEvent } from "../../types";
import { CheckboxRootContext, useCheckboxRootContext } from "./CheckboxRootContext";

export const PARENT_CHECKBOX = "data-parent";

const EMPTY_OBJECT: Record<string, any> = {};

/**
 * Represents the checkbox itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Rebase UI Checkbox](https://rebase-ui.knst.dev/components/checkbox)
 */
export function CheckboxRoot<T extends JSX.ElementType = "span">(props: CheckboxRoot.Props<T>) {
  const rest = omitProps(
    props,
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
    "onClick",
    "onMouseDown",
    "onKeyUp",
    "onKeyDown",
    "onPointerDown",
    "onFocus",
    "onBlur",
    "aria-describedby",
    "class",
    "style",
    "children",
    "ref",
  );

  // One-shot read (matching the Solid layer, where it is untracked).
  const nativeButton = props.nativeButton ?? false;

  function parent(): boolean {
    return props.parent ?? false;
  }

  const form = useFormContext();
  const {
    disabled: rootDisabled,
    name: fieldName,
    setDirty,
    setFilled,
    setTouched,
    state: fieldState,
    validationMode,
    validityData,
    validation: localValidation,
  } = useFieldRootContext();
  const { disabled: itemDisabled } = useFieldItemContext();
  const { labelId, registerControlId } = useLabelableContext();

  const groupContext = useCheckboxGroupContext(true);
  const parentContext = () => (groupContext?.allValues() === undefined ? undefined : groupContext.parent);
  const isGroupedWithParent = () => parentContext() !== undefined;

  function disabled(): boolean {
    return rootDisabled() === true || itemDisabled() || groupContext?.disabled() === true || props.disabled === true;
  }

  function name(): string | undefined {
    return fieldName() ?? props.name;
  }

  function value(): string | undefined {
    return props.value ?? name();
  }

  const generatedId = createUniqueId();

  // A `CheckboxGroup` is the field's control and takes its name from `aria-labelledby`, so the
  // checkboxes sharing its labelable scope must not claim the field's control id: they would all
  // render that one id and collide. A `Field.Item` opens a scope the checkbox does own.
  const ownsControlId = () => groupContext?.registerControlId !== registerControlId;

  // `|| undefined` rather than `??`: an empty `id` falls back to the scope's control id.
  const controlId = createLabelableId({ id: () => props.id || undefined, enabled: ownsControlId });

  const rootId = () => (nativeButton ? controlId() : generatedId);

  function groupProps(): Record<string, any> {
    if (!isGroupedWithParent()) {
      return EMPTY_OBJECT;
    }

    const groupParent = parentContext()!;
    if (parent()) {
      return groupParent.getParentProps() as Record<string, any>;
    }

    const currentValue = value();
    return currentValue !== undefined ? (groupParent.getChildProps(currentValue) as Record<string, any>) : EMPTY_OBJECT;
  }

  function groupChecked(): boolean | undefined {
    const current = groupProps();
    return "checked" in current ? current.checked : props.checked;
  }

  function groupIndeterminate(): boolean | undefined {
    const current = groupProps();
    return "indeterminate" in current ? current.indeterminate : props.indeterminate;
  }

  function groupOnChange(): ((checked: boolean, details: CheckboxRoot.ChangeEventDetails) => void) | undefined {
    return groupProps().onCheckedChange;
  }

  const groupValue = () => groupContext?.value();

  const validation = groupContext?.validation ?? localValidation;

  const [checked, setCheckedState] = createControllableSignal<boolean>({
    value: () => {
      const currentValue = value();
      const currentGroupValue = groupValue();
      return currentValue !== undefined && currentGroupValue !== undefined && !parent()
        ? currentGroupValue.includes(currentValue)
        : groupChecked();
    },
    defaultValue: () => props.defaultChecked ?? false,
  });

  const computedChecked = () => (isGroupedWithParent() ? Boolean(groupChecked()) : (checked() ?? false));
  const computedIndeterminate = () =>
    isGroupedWithParent() ? Boolean(groupIndeterminate() || props.indeterminate) : (props.indeterminate ?? false);

  let controlElement: HTMLElement | null = null;
  const inputStore = store({ element: null as HTMLInputElement | null });
  const setFocused = createSetFieldFocused(disabled, () => controlElement);

  const button = createButton({
    get disabled() {
      return disabled();
    },
    get nativeButton() {
      return nativeButton;
    },
    get onClick() {
      return handleClick;
    },
    get onMouseDown() {
      return props.onMouseDown;
    },
    get onKeyDown() {
      return handleKeyDown;
    },
    get onKeyUp() {
      return props.onKeyUp;
    },
    get onPointerDown() {
      return props.onPointerDown;
    },
  });

  createRegisterFieldControl({
    controlElement: () => controlElement,
    id: () => generatedId,
    value: checked,
    enabled: () => !groupContext && !disabled(),
    name: () => props.name,
  });

  const registeredInputValue = () => (groupContext ? value() : undefined);

  effect(() => {
    const element = inputStore.element;
    const isParent = props.parent ?? false;

    if (element == null || isParent) {
      return;
    }

    // One-shot read: the registered value is a snapshot taken at mount, matching the
    // Solid layer where the registration runs once from the input ref.
    const snapshotValue = untrack(registeredInputValue);
    const unregister = validation.registerInput(element, {
      get controlElement() {
        return controlElement;
      },
      value: snapshotValue,
    });

    onCleanup(() => {
      unregister?.();
    });
  });

  function handleInputRef(element: HTMLInputElement | null): void {
    inputStore.element = element;
    if (element !== null) {
      props.inputRef?.(element);
    }
  }

  const ariaLabelledBy = createAriaLabelledBy({
    ariaLabelledBy: () => (props as unknown as Record<string, string | undefined>)["aria-labelledby"],
    labelId,
    labelSource: () => inputStore.element,
    enableFallback: () => !nativeButton,
    labelSourceId: controlId,
    ariaLabel: () => (rest as Record<string, unknown>)["aria-label"] as string | undefined,
  });

  effect(() => {
    const element = inputStore.element;
    const indeterminate = computedIndeterminate();
    const isChecked = checked() ?? false;

    // Actions never subscribe: the DOM and field writes below only store, so the
    // effect tracks just the input element, indeterminate, and checked inputs above.
    untrack(() => {
      if (element !== null) {
        // Re-assert on `checked` changes too: clicking the input natively resets `indeterminate`.
        element.indeterminate = indeterminate;
      }

      // Inside a group, the group derives the filled state from its value.
      if (!groupContext) {
        setFilled(isChecked);
      }
    });
  });

  let checkedChanged = false;
  effect(() => {
    const isChecked = checked() ?? false;

    // One-shot reads: the field/form state below is consumed, never tracked.
    untrack(() => {
      if (!checkedChanged) {
        checkedChanged = true;
        return;
      }

      if (groupContext) {
        return;
      }

      form.clearErrors(name());
      setDirty(isChecked !== validityData.initialValue);

      validation.change(isChecked);
    });
  });

  effect(() => {
    const parent = parentContext();
    const currentValue = value();
    const isDisabled = disabled();

    if (!parent || currentValue === undefined) {
      return;
    }

    // Actions never subscribe: the write below only stores, so the effect tracks
    // just the parent, value, and disabled inputs above.
    untrack(() => {
      parent.disabledStates.set(currentValue, isDisabled);
    });

    onCleanup(() => {
      parent.disabledStates.delete(currentValue);
    });
  });

  effect(() => {
    const parent = parentContext();
    const currentValue = value();
    const id = rootId();
    const isParent = props.parent ?? false;

    if (!parent || isParent || currentValue === undefined || id === undefined) {
      return;
    }

    // Actions never subscribe: the registration below only stores, so the effect
    // tracks just the parent, value, id, and parent-flag inputs above.
    const unregister = untrack(() => parent.registerChildId(currentValue, id));

    onCleanup(() => {
      unregister();
    });
  });

  const state: CheckboxRootContext = {
    ...fieldState,
    checked: computedChecked,
    disabled,
    readOnly: () => props.readOnly ?? false,
    required: () => props.required ?? false,
    indeterminate: computedIndeterminate,
  };

  const isGroupedParent = untrack(isGroupedWithParent) && (props.parent ?? false);

  function parentAriaControls(): string | undefined {
    return isGroupedParent ? (groupProps()["aria-controls"] as string | undefined) : undefined;
  }

  const externalValidationProps: Record<string, any> = {};
  Object.defineProperty(externalValidationProps, "aria-describedby", {
    enumerable: true,
    configurable: true,
    get: () => (props as unknown as Record<string, string | undefined>)["aria-describedby"],
  });
  const validationProps = validation.getValidationProps(disabled, externalValidationProps);
  // The hidden input only sees the labelable messages: in the Solid layer its props
  // layer carries no user `aria-describedby` to merge.
  const inputValidationProps = validation.getValidationProps(disabled, {});

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

    const input = inputStore.element;
    if (!input) {
      return;
    }

    setTouched(true);
    setFocused(false);

    if (validationMode === "onBlur") {
      void validation.commit(groupContext ? groupValue() : input.checked);
    }
  }

  function handleClick(event: MouseEvent): void {
    makeEventPreventable(event as RebaseUIEvent<MouseEvent>);
    (props.onClick as unknown as ((event: MouseEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<MouseEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    if (props.readOnly === true || disabled()) {
      return;
    }

    event.preventDefault();

    const input = inputStore.element;
    if (!input) {
      return;
    }

    dispatchClickWithModifiers(input, event);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    makeEventPreventable(event as RebaseUIEvent<KeyboardEvent>);
    (props.onKeyDown as unknown as ((event: KeyboardEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<KeyboardEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    // Enter must not toggle the checkbox, but a consumer handler running later during
    // propagation still needs to be able to opt out of submitting the form.
    const formToSubmit = inputStore.element?.form ?? null;
    const currentTarget = event.currentTarget as Element;
    const originalPreventDefault = event.preventDefault.bind(event);
    let preventDefaultCalledAfterPropagation = false;

    event.preventDefault();

    (event as unknown as { preventDefault: () => void }).preventDefault = () => {
      preventDefaultCalledAfterPropagation = true;
      originalPreventDefault();
    };

    const view = currentTarget.ownerDocument?.defaultView ?? window;
    view.queueMicrotask(() => {
      (event as unknown as { preventDefault: () => void }).preventDefault = originalPreventDefault;

      if (!preventDefaultCalledAfterPropagation) {
        getDefaultFormSubmitter(formToSubmit)?.click();
      }
    });
  }

  function onInputChange(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    const nextChecked = target.checked;
    // Native activation precedes change. Restore the committed state before
    // proposing an update; an accepted update will project through the signals.
    target.checked = untrack(checked) ?? false;
    target.indeterminate = Boolean(untrack(computedIndeterminate));
    if (props.readOnly === true) {
      event.preventDefault();
      return;
    }

    const details = createChangeEventDetails(REASONS.none, event);

    props.onCheckedChange?.(nextChecked, details);

    if (details.isCanceled) {
      return;
    }

    groupOnChange()?.(nextChecked, details);

    if (details.isCanceled) {
      return;
    }

    setCheckedState(nextChecked);

    const currentValue = value();
    if (currentValue !== undefined && groupContext !== undefined && !parent() && !isGroupedWithParent()) {
      const nextGroupValue = nextChecked
        ? [...groupContext.value(), currentValue]
        : groupContext.value().filter((item) => item !== currentValue);

      groupContext.setValue(nextGroupValue, details);
    }
  }

  const ref = mergeRefs(
    button.buttonRef,
    (element: HTMLElement | null) => {
      controlElement = element;
    },
    props.ref as ((element: HTMLElement | null) => void) | undefined,
  );

  function inputValue(): string | undefined {
    if (props.value === undefined) {
      return undefined;
    }
    return (groupContext ? (checked() ?? false) && props.value : props.value) || "";
  }

  function snapshot(): CheckboxRootState {
    return {
      ...getFieldStateSnapshot(state),
      checked: computedChecked(),
      readOnly: props.readOnly ?? false,
      required: props.required ?? false,
      indeterminate: computedIndeterminate(),
    };
  }

  function renderHiddenInputs(): JSX.Element {
    return (
      <>
        {!computedChecked() && !groupContext && name() && !parent() && props.uncheckedValue !== undefined && (
          <input type="hidden" form={props.form} name={name()} value={props.uncheckedValue} bool:disabled={disabled()} />
        )}
        <input
          ref={handleInputRef}
          type="checkbox"
          aria-hidden="true"
          tabindex={-1}
          checked={checked() ?? false}
          bool:disabled={disabled()}
          form={props.form}
          // Parent checkboxes unset `name` to be excluded from form submission.
          name={parent() ? undefined : name()}
          // Set `id` to stop Chrome warning about an unassociated input.
          // When using a native button, the `id` is applied to the button instead.
          id={nativeButton ? undefined : controlId()}
          bool:required={props.required ?? false}
          value={inputValue()}
          style={name() ? visuallyHiddenInput : visuallyHidden}
          aria-describedby={inputValidationProps["aria-describedby"]}
          aria-invalid={inputValidationProps["aria-invalid"]}
          onChange={onInputChange}
          // The click dispatched from the root's `onClick` is an implementation detail
          // and must not reach ancestors, which already receive the original click.
          onClick={(event: MouseEvent) => event.stopPropagation()}
          onFocus={() => controlElement?.focus()}
        />
      </>
    );
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  // `as` is resolved once (matching the Solid layer, where it is untracked): a dynamic element
  // re-creates its DOM node whenever a sibling mounts or unmounts, which would drop the
  // control's focus and listeners every time the hidden input appears or disappears. The
  // default path renders a static `<span>`; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    // The static `<span>` omits `type`: it never applies to a span (the Solid layer spreads
    // it, where it is a void attribute). The dynamic branch still binds it for a native `<button>`.
    return (
      <>
        <span
          {...(rest as Record<string, unknown>)}
          id={rootId()}
          role="checkbox"
          aria-checked={computedIndeterminate() ? "mixed" : computedChecked() ? "true" : "false"}
          aria-readonly={props.readOnly === true ? "true" : undefined}
          aria-required={props.required === true ? "true" : undefined}
          aria-labelledby={ariaLabelledBy()}
          aria-controls={parentAriaControls()}
          aria-describedby={validationProps["aria-describedby"]}
          aria-invalid={validationProps["aria-invalid"]}
          data-parent={parent() ? "" : undefined}
          bool:disabled={button.disabled}
          tabindex={button.tabIndex}
          aria-disabled={button.ariaDisabled}
          data-checked={!computedIndeterminate() && computedChecked() ? "" : undefined}
          data-unchecked={!computedIndeterminate() && !computedChecked() ? "" : undefined}
          data-indeterminate={computedIndeterminate() ? "" : undefined}
          data-disabled={disabled() ? "" : undefined}
          data-readonly={props.readOnly === true ? "" : undefined}
          data-required={props.required === true ? "" : undefined}
          data-valid={state.valid() === true ? "" : undefined}
          data-invalid={state.valid() === false ? "" : undefined}
          data-touched={state.touched() ? "" : undefined}
          data-dirty={state.dirty() ? "" : undefined}
          data-filled={state.filled() ? "" : undefined}
          data-focused={state.focused() ? "" : undefined}
          data-validating={state.validating() ? "" : undefined}
          class={resolveClassValue(props.class, snapshot())}
          style={resolveStyleValue(props.style, snapshot())}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClick={button.onClick}
          onMouseDown={button.onMouseDown}
          onKeyDown={button.onKeyDown}
          onKeyUp={button.onKeyUp}
          onPointerDown={button.onPointerDown}
          ref={ref}
        >
          <CheckboxRootContext value={state}>
            <CheckboxRootContent>{props.children}</CheckboxRootContent>
          </CheckboxRootContext>
        </span>
        {renderHiddenInputs()}
      </>
    );
  }

  return (
    <>
      <Tag
        {...(rest as Record<string, unknown>)}
        id={rootId()}
        role="checkbox"
        aria-checked={computedIndeterminate() ? "mixed" : computedChecked() ? "true" : "false"}
        aria-readonly={props.readOnly === true ? "true" : undefined}
        aria-required={props.required === true ? "true" : undefined}
        aria-labelledby={ariaLabelledBy()}
        aria-controls={parentAriaControls()}
        aria-describedby={validationProps["aria-describedby"]}
        aria-invalid={validationProps["aria-invalid"]}
        data-parent={parent() ? "" : undefined}
        type={button.type}
        bool:disabled={button.disabled}
        tabindex={button.tabIndex}
        aria-disabled={button.ariaDisabled}
        data-checked={!computedIndeterminate() && computedChecked() ? "" : undefined}
        data-unchecked={!computedIndeterminate() && !computedChecked() ? "" : undefined}
        data-indeterminate={computedIndeterminate() ? "" : undefined}
        data-disabled={disabled() ? "" : undefined}
        data-readonly={props.readOnly === true ? "" : undefined}
        data-required={props.required === true ? "" : undefined}
        data-valid={state.valid() === true ? "" : undefined}
        data-invalid={state.valid() === false ? "" : undefined}
        data-touched={state.touched() ? "" : undefined}
        data-dirty={state.dirty() ? "" : undefined}
        data-filled={state.filled() ? "" : undefined}
        data-focused={state.focused() ? "" : undefined}
        data-validating={state.validating() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={button.onClick}
        onMouseDown={button.onMouseDown}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        onPointerDown={button.onPointerDown}
        ref={ref}
      >
        <CheckboxRootContext value={state}>
          <CheckboxRootContent>{props.children}</CheckboxRootContent>
        </CheckboxRootContext>
      </Tag>
      {renderHiddenInputs()}
    </>
  );
}

/**
 * Resolves the root children inside the checkbox context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the state changes, matching the Solid layer where the children
 * memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function CheckboxRootContent(props: { children: ChildrenValue<CheckboxRootState> }) {
  const children = props.children;

  const rootState = useCheckboxRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: CheckboxRootState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the checkbox context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: CheckboxRootState = {
        ...getFieldStateSnapshot(rootState),
        checked: rootState.checked(),
        readOnly: rootState.readOnly(),
        required: rootState.required(),
        indeterminate: rootState.indeterminate(),
      };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface CheckboxRootState extends FieldRootState {
  /**
   * Whether the checkbox is currently ticked.
   */
  checked: boolean;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   */
  required: boolean;
  /**
   * Whether the checkbox is in a mixed state — neither ticked, nor unticked.
   */
  indeterminate: boolean;
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

export type CheckboxRootProps<T extends JSX.ElementType = "span"> = CheckboxRootOwnProps &
  NativeButtonProps &
  ButtonEventHandlers &
  Omit<RebaseUIComponentProps<T, CheckboxRootState>, "onChange" | "value">;

export type CheckboxRootChangeEventReason = typeof REASONS.none;

export type CheckboxRootChangeEventDetails = RebaseUIChangeEventDetails<CheckboxRoot.ChangeEventReason>;

export namespace CheckboxRoot {
  export type State = CheckboxRootState;
  export type Props<T extends JSX.ElementType = "span"> = CheckboxRootProps<T>;
  export type OwnProps = CheckboxRootOwnProps;
  export type ChangeEventReason = CheckboxRootChangeEventReason;
  export type ChangeEventDetails = CheckboxRootChangeEventDetails;
}
