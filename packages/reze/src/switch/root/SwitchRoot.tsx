import { createUniqueId, dynamicElement, effect, getOwner, omitProps, onCleanup, runWithOwner, store, untrack, type JSX } from "reze-js";

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
import type { ButtonEventHandlers, ChildrenValue, NonNativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { visuallyHidden, visuallyHiddenInput } from "../../internals/utils/visuallyHidden";
import type { RebaseUIEvent } from "../../types";
import { SwitchRootContext, useSwitchRootContext } from "./SwitchRootContext";

/**
 * Represents the switch itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Rebase UI Switch](https://rebase-ui.knst.dev/components/switch)
 */
export function SwitchRoot<T extends JSX.ElementType = "span">(props: SwitchRoot.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "aria-labelledby",
    "checked",
    "defaultChecked",
    "disabled",
    "form",
    "id",
    "inputRef",
    "name",
    "nativeButton",
    "onCheckedChange",
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
  const { labelId } = useLabelableContext();

  function disabled(): boolean {
    return rootDisabled() === true || itemDisabled() || props.disabled === true;
  }

  function name(): string | undefined {
    return fieldName() ?? props.name;
  }

  const generatedId = createUniqueId();
  // `|| undefined` rather than `??`: an empty `id` falls back to the scope's control id.
  const controlId = createLabelableId({ id: () => props.id || undefined });
  const rootId = () => (nativeButton ? controlId() : generatedId);

  const validation = localValidation;

  const [checked, setCheckedState] = createControllableSignal<boolean>({
    value: () => props.checked,
    defaultValue: () => props.defaultChecked ?? false,
  });

  const computedChecked = () => checked() ?? false;

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
    enabled: () => !disabled(),
    name: () => props.name,
  });

  effect(() => {
    const element = inputStore.element;

    if (element == null) {
      return;
    }

    const unregister = validation.registerInput(element, {
      get controlElement() {
        return controlElement;
      },
      value: undefined,
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
    const isChecked = checked() ?? false;

    // Actions never subscribe: the write below only stores, so the effect tracks
    // just the checked input above.
    untrack(() => setFilled(isChecked));
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

      form.clearErrors(name());
      setDirty(isChecked !== validityData.initialValue);

      validation.change(isChecked);
    });
  });

  const state: SwitchRootContext = {
    ...fieldState,
    checked: computedChecked,
    disabled,
    readOnly: () => props.readOnly ?? false,
    required: () => props.required ?? false,
  };

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
    if (!input || disabled()) {
      return;
    }

    setTouched(true);
    setFocused(false);

    if (validationMode === "onBlur") {
      void validation.commit(input.checked);
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

    // Enter must not toggle the switch, but a consumer handler running later during
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
    if (props.readOnly === true) {
      event.preventDefault();
      return;
    }

    const nextChecked = (event.currentTarget as HTMLInputElement).checked;
    const details = createChangeEventDetails(REASONS.none, event);

    props.onCheckedChange?.(nextChecked, details);

    if (details.isCanceled) {
      return;
    }

    setCheckedState(nextChecked);
  }

  const ref = mergeRefs(
    button.buttonRef,
    (element: HTMLElement | null) => {
      controlElement = element;
    },
    props.ref as ((element: HTMLElement | null) => void) | undefined,
  );

  function snapshot(): SwitchRootState {
    return {
      ...getFieldStateSnapshot(state),
      checked: computedChecked(),
      readOnly: props.readOnly ?? false,
      required: props.required ?? false,
    };
  }

  function renderHiddenInputs(): JSX.Element {
    return (
      <>
        {!computedChecked() && name() && props.uncheckedValue !== undefined && (
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
          name={name()}
          id={nativeButton ? undefined : controlId()}
          bool:required={props.required ?? false}
          value={props.value}
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
          role="switch"
          aria-checked={computedChecked() ? "true" : "false"}
          aria-readonly={props.readOnly === true ? "true" : undefined}
          aria-required={props.required === true ? "true" : undefined}
          aria-labelledby={ariaLabelledBy()}
          aria-describedby={validationProps["aria-describedby"]}
          aria-invalid={validationProps["aria-invalid"]}
          bool:disabled={button.disabled}
          tabindex={button.tabIndex}
          aria-disabled={button.ariaDisabled}
          data-checked={computedChecked() ? "" : undefined}
          data-unchecked={!computedChecked() ? "" : undefined}
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
          <SwitchRootContext value={state}>
            <SwitchRootContent>{props.children}</SwitchRootContent>
          </SwitchRootContext>
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
        role="switch"
        aria-checked={computedChecked() ? "true" : "false"}
        aria-readonly={props.readOnly === true ? "true" : undefined}
        aria-required={props.required === true ? "true" : undefined}
        aria-labelledby={ariaLabelledBy()}
        aria-describedby={validationProps["aria-describedby"]}
        aria-invalid={validationProps["aria-invalid"]}
        type={button.type}
        bool:disabled={button.disabled}
        tabindex={button.tabIndex}
        aria-disabled={button.ariaDisabled}
        data-checked={computedChecked() ? "" : undefined}
        data-unchecked={!computedChecked() ? "" : undefined}
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
        <SwitchRootContext value={state}>
          <SwitchRootContent>{props.children}</SwitchRootContent>
        </SwitchRootContext>
      </Tag>
      {renderHiddenInputs()}
    </>
  );
}

/**
 * Resolves the root children inside the switch context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the state changes, matching the Solid layer where the children
 * memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function SwitchRootContent(props: { children: ChildrenValue<SwitchRootState> }) {
  const children = props.children;

  const rootState = useSwitchRootContext();

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: SwitchRootState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the switch context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const snapshot: SwitchRootState = {
        ...getFieldStateSnapshot(rootState),
        checked: rootState.checked(),
        readOnly: rootState.readOnly(),
        required: rootState.required(),
      };

      return runWithOwner(owner, () => render(snapshot));
    };
  }

  return children as JSX.Element;
}

export interface SwitchRootState extends FieldRootState {
  /**
   * Whether the switch is currently active.
   */
  checked: boolean;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   */
  readOnly: boolean;
  /**
   * Whether the user must activate the switch before submitting a form.
   */
  required: boolean;
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

export type SwitchRootProps<T extends JSX.ElementType = "span"> = SwitchRootOwnProps &
  ButtonEventHandlers &
  Omit<RebaseUIComponentProps<T, SwitchRootState>, "onChange">;

export type SwitchRootChangeEventReason = typeof REASONS.none;

export type SwitchRootChangeEventDetails = RebaseUIChangeEventDetails<SwitchRoot.ChangeEventReason>;

export namespace SwitchRoot {
  export type State = SwitchRootState;
  export type Props<T extends JSX.ElementType = "span"> = SwitchRootProps<T>;
  export type OwnProps = SwitchRootOwnProps;
  export type ChangeEventReason = SwitchRootChangeEventReason;
  export type ChangeEventDetails = SwitchRootChangeEventDetails;
}
