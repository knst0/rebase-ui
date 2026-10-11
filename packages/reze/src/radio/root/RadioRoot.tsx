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

import { useFieldItemContext } from "../../field/item/FieldItemContext";
import type { FieldRootState } from "../../field/root/FieldRoot";
import { useRadioGroupContext } from "../../radio-group/RadioGroupContext";
import { createButton } from "../../internals/create-button";
import { dispatchClickWithModifiers } from "../../internals/dispatchClickWithModifiers";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { createSetFieldFocused, useFieldRootContext } from "../../internals/field-root-context";
import { createAriaLabelledBy, createLabelableId, useLabelableContext, type LabelSource } from "../../internals/labelable-provider";
import { makeEventPreventable } from "../../internals/makeEventPreventable";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type {
  ButtonEventHandlers,
  ChildrenValue,
  NonNativeButtonProps,
  RebaseUIComponentProps,
} from "../../internals/types";
import { visuallyHidden, visuallyHiddenInput } from "../../internals/utils/visuallyHidden";
import type { RebaseUIEvent } from "../../types";
import { RadioRootContext, useRadioRootContext } from "./RadioRootContext";

/**
 * Represents the radio button itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Rebase UI Radio](https://rebase-ui.knst.dev/components/radio)
 */
export function RadioRoot<Value, T extends JSX.ElementType = "span">(props: RadioRoot.Props<Value, T>) {
  const rest = omitProps(
    props,
    "as",
    "aria-labelledby",
    "disabled",
    "id",
    "inputRef",
    "nativeButton",
    "readOnly",
    "required",
    "value",
    "onClick",
    "onMouseDown",
    "onKeyUp",
    "onKeyDown",
    "onPointerDown",
    "onFocus",
    "onBlur",
    "aria-disabled",
    "aria-invalid",
    "class",
    "style",
    "children",
    "ref",
  );

  const nativeButton = props.nativeButton ?? false;

  const groupContext = useRadioGroupContext();

  const field = useFieldRootContext();
  const { disabled: itemDisabled } = useFieldItemContext();
  const { labelId } = useLabelableContext();

  function disabled(): boolean {
    return (
      field.disabled() === true || itemDisabled() === true || groupContext?.disabled() === true || props.disabled === true
    );
  }

  function readOnly(): boolean {
    return groupContext?.readOnly() === true || props.readOnly === true;
  }

  function required(): boolean {
    return groupContext?.required() === true || props.required === true;
  }

  const form = groupContext?.form;

  function name(): string | undefined {
    return groupContext?.name;
  }

  function checked(): boolean {
    return groupContext ? groupContext.checkedValue() === props.value : (props.value as unknown) === "";
  }

  let radioElement: HTMLElement | null = null;
  let inputElement: HTMLInputElement | null = null;
  const setFieldFocused = createSetFieldFocused(disabled, () => radioElement);
  const labelSourceStore = store({ element: null as LabelSource | null });
  // Effects run before the elements mount, so the mounted input is tracked in a store:
  // the ref write below re-runs the registration effect once the input exists.
  const inputStore = store({ element: null as HTMLInputElement | null });

  function labelSource(): LabelSource | null {
    return labelSourceStore.element;
  }

  const validation = groupContext?.validation ?? field.validation;

  const mergedInputRef = mergeRefs(
    (element: HTMLInputElement | null) => {
      if (element !== null) {
        props.inputRef?.(element);
      }
    },
    (element: HTMLInputElement | null) => {
      inputElement = element;
      labelSourceStore.element = element;
      inputStore.element = element;
      if (element !== null && element.checked) {
        field.setFilled(true);
      }
    },
    (element: HTMLInputElement | null) => {
      if (element !== null) {
        validation.registerInput(element, {
          get controlElement() {
            return radioElement;
          },
          value: undefined,
        });
      }
    },
  );

  let detachGroupInput: void | (() => void) | undefined;
  effect(() => {
    const element = inputStore.element;
    const isChecked = checked();
    const isDisabled = disabled();

    // The registration only writes, so the effect tracks just the mounted input
    // and the checked/disabled inputs above.
    untrack(() => {
      const register = groupContext?.registerInputRef;
      if (!register || !element) {
        return;
      }

      if (isDisabled && isChecked) {
        register(null);
        return;
      }

      detachGroupInput = register(element, isChecked) ?? undefined;
    });
  });

  onCleanup(() => {
    detachGroupInput?.();
  });

  const generatedId = createUniqueId();
  const controlId = createLabelableId({ id: () => props.id || undefined });

  function rootId(): string {
    return nativeButton ? controlId() : generatedId;
  }

  function hiddenInputId(): string | undefined {
    return nativeButton ? undefined : controlId();
  }

  const ariaLabelledBy = createAriaLabelledBy({
    ariaLabelledBy: () => (props as unknown as Record<string, string | undefined>)["aria-labelledby"],
    labelId,
    labelSource,
    enableFallback: () => !nativeButton,
    labelSourceId: controlId,
    ariaLabel: () => (props as unknown as Record<string, string | undefined>)["aria-label"],
  });

  function handleKeyDown(event: KeyboardEvent): void {
    makeEventPreventable(event as RebaseUIEvent<KeyboardEvent>);
    (props.onKeyDown as unknown as ((event: KeyboardEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<KeyboardEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    if (event.key === "Enter") {
      // Radio only activates with Space. Preventing the keydown's default
      // stops the button behavior from turning Enter into a click.
      event.preventDefault();
    }
  }

  function handleClick(event: MouseEvent): void {
    makeEventPreventable(event as RebaseUIEvent<MouseEvent>);
    (props.onClick as unknown as ((event: MouseEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<MouseEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    if (event.defaultPrevented || disabled() || readOnly()) {
      return;
    }

    event.preventDefault();

    if (!inputElement) {
      return;
    }

    dispatchClickWithModifiers(inputElement, event);
  }

  function handleFocus(event: FocusEvent): void {
    makeEventPreventable(event as RebaseUIEvent<FocusEvent>);
    (props.onFocus as unknown as ((event: FocusEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<FocusEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    setFieldFocused(true);

    if (event.defaultPrevented || disabled() || readOnly() || !groupContext?.touched()) {
      return;
    }

    inputElement?.click();

    groupContext?.setTouched(false);
  }

  function handleBlur(event: FocusEvent): void {
    makeEventPreventable(event as RebaseUIEvent<FocusEvent>);
    (props.onBlur as unknown as ((event: FocusEvent) => void) | undefined)?.(event);
    if ((event as RebaseUIEvent<FocusEvent>).rebaseUIHandlerPrevented) {
      return;
    }

    // A grouped radio's exit is cleared by the group's `contains`-guarded blur handler, so
    // radio-to-radio moves inside the group don't churn the focused state.
    if (!groupContext) {
      setFieldFocused(false);
    }
  }

  const button = createButton({
    get disabled() {
      return disabled();
    },
    nativeButton,
    onClick: handleClick as (event: RebaseUIEvent<MouseEvent>) => void,
    onMouseDown: props.onMouseDown,
    onKeyUp: props.onKeyUp,
    onKeyDown: handleKeyDown as (event: RebaseUIEvent<KeyboardEvent>) => void,
    onPointerDown: props.onPointerDown,
  });

  // Spread after `rest` so `type="button"` wins for native buttons; `span` has no
  // `type` in its JSX props, so an explicit attribute would not typecheck there.
  const nativeType: { type?: "button" } = nativeButton ? { type: "button" } : {};

  function isTabStop(): boolean {
    if (!groupContext || disabled()) {
      return false;
    }

    const current = groupContext.checkedValue();
    if (current !== undefined) {
      return checked();
    }

    // No selection: the first enabled radio in DOM order is the tab stop. The
    // version read re-evaluates every radio when siblings mount or unmount.
    groupContext.itemsVersion();
    const group = groupContext.getGroupElement();
    if (!group || !radioElement) {
      return false;
    }

    const radios = group.querySelectorAll('[role="radio"]');
    for (const element of radios) {
      if (element.closest('[role="radiogroup"]') !== group || element.hasAttribute("data-disabled")) {
        continue;
      }
      return element === radioElement;
    }

    return false;
  }

  function tabIndex(): number | undefined {
    if (!groupContext) {
      return button.tabIndex;
    }
    return isTabStop() ? 0 : -1;
  }

  const selectors: FieldRootStateSelectors = { ...field.state, disabled };

  function snapshot(): RadioRootState {
    return { ...getFieldStateSnapshot(selectors), checked: checked(), readOnly: readOnly(), required: required() };
  }

  const contextValue: RadioRootContext = {
    disabled,
    touched: selectors.touched,
    dirty: selectors.dirty,
    valid: selectors.valid,
    filled: selectors.filled,
    focused: selectors.focused,
    validating: selectors.validating,
    checked,
    readOnly,
    required,
  };

  const externalValidationProps: Record<string, any> = {};
  Object.defineProperty(externalValidationProps, "aria-describedby", {
    enumerable: true,
    configurable: true,
    get: () => (props as unknown as Record<string, string | undefined>)["aria-describedby"],
  });
  const validationProps = validation.getValidationProps(disabled, externalValidationProps);

  let unregisterItem: (() => void) | undefined;
  const rootRef = mergeRefs(
    button.buttonRef,
    (element: HTMLElement | null) => {
      radioElement = element;
      if (element !== null && groupContext) {
        unregisterItem = groupContext.registerItem(element);
      } else {
        unregisterItem?.();
        unregisterItem = undefined;
      }
    },
    props.ref as ((element: HTMLElement | null) => void) | undefined,
  );

  onCleanup(() => {
    unregisterItem?.();
  });

  function serializedValue(): string | undefined {
    const value = props.value;
    return value === undefined ? undefined : serializeValue(value);
  }

  function handleInputChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    input.checked = untrack(checked);
    if (disabled() || readOnly() || props.value === undefined) {
      return;
    }

    const details = createChangeEventDetails(REASONS.none, event);

    groupContext?.setCheckedValue(props.value, details);

    if (details.isCanceled) {
      return;
    }

    field.setTouched(true);
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "span");

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts, which would drop the radio's focus and listeners. The default path renders a
  // static `<span>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  // The provider lives inside the root: context does not flow through dynamicElement,
  // so providing above it would leave the indicator without context. Children
  // resolve in RadioRootContent below so they are created inside the provider.
  if (props.as == null) {
    return (
      <>
        <span
          {...(rest as Record<string, unknown>)}
          {...nativeType}
          role="radio"
          aria-checked={checked() ? "true" : "false"}
          aria-labelledby={ariaLabelledBy()}
          aria-describedby={validationProps["aria-describedby"]}
          aria-invalid={validationProps["aria-invalid"]}
          aria-disabled={button.ariaDisabled}
          bool:disabled={button.disabled}
          tabindex={tabIndex()}
          id={rootId()}
          data-checked={checked() ? "" : undefined}
          data-unchecked={checked() ? undefined : ""}
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
          onClick={button.onClick}
          onMouseDown={button.onMouseDown}
          onKeyDown={button.onKeyDown}
          onKeyUp={button.onKeyUp}
          onPointerDown={button.onPointerDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          ref={rootRef}
        >
          <RadioRootContext value={contextValue}>
            <RadioRootContent>{props.children}</RadioRootContent>
          </RadioRootContext>
        </span>
        <input
          ref={mergedInputRef}
          type="radio"
          aria-hidden="true"
          tabindex={-1}
          checked={checked()}
          bool:disabled={disabled()}
          form={form}
          id={hiddenInputId()}
          name={name()}
          bool:required={required()}
          readonly={readOnly()}
          value={serializedValue()}
          style={name() ? visuallyHiddenInput : visuallyHidden}
          onChange={handleInputChange}
          // Clicks dispatched on the input from the root's `onClick` and `onFocus` are an
          // implementation detail and must not reach ancestors.
          onClick={(event: MouseEvent) => event.stopPropagation()}
          onFocus={() => radioElement?.focus()}
        />
      </>
    );
  }

  return (
    <>
      <Tag
        {...(rest as Record<string, unknown>)}
        {...nativeType}
        role="radio"
        aria-checked={checked() ? "true" : "false"}
        aria-labelledby={ariaLabelledBy()}
        aria-describedby={validationProps["aria-describedby"]}
        aria-invalid={validationProps["aria-invalid"]}
        aria-disabled={button.ariaDisabled}
        bool:disabled={button.disabled}
        tabindex={tabIndex()}
        id={rootId()}
        data-checked={checked() ? "" : undefined}
        data-unchecked={checked() ? undefined : ""}
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
        onClick={button.onClick}
        onMouseDown={button.onMouseDown}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        onPointerDown={button.onPointerDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        ref={rootRef}
      >
        <RadioRootContext value={contextValue}>
          <RadioRootContent>{props.children}</RadioRootContent>
        </RadioRootContext>
      </Tag>
      <input
        ref={mergedInputRef}
        type="radio"
        aria-hidden="true"
        tabindex={-1}
        checked={checked()}
        bool:disabled={disabled()}
        form={form}
        id={hiddenInputId()}
        name={name()}
        bool:required={required()}
        readonly={readOnly()}
        value={serializedValue()}
        style={name() ? visuallyHiddenInput : visuallyHidden}
        onChange={handleInputChange}
        // Clicks dispatched on the input from the root's `onClick` and `onFocus` are an
        // implementation detail and must not reach ancestors.
        onClick={(event: MouseEvent) => event.stopPropagation()}
        onFocus={() => radioElement?.focus()}
      />
    </>
  );
}

/**
 * Resolves the root children inside the radio root context. Render-prop children are
 * invoked inside a thunk (bound by the renderer) and re-invoked with a fresh state
 * snapshot whenever the radio state changes, matching the Solid layer where the
 * children memo re-resolves on state change.
 *
 * Zero-argument functions pass through untouched: Reze control-flow primitives return
 * thunks, and invoking one here would resolve the subtree one-shot instead of binding it.
 */
export function RadioRootContent(props: { children: ChildrenValue<RadioRootState> }) {
  const children = props.children;

  const rootState = useRadioRootContext();

  function snapshot(): RadioRootState {
    return {
      disabled: rootState.disabled(),
      touched: rootState.touched(),
      dirty: rootState.dirty(),
      valid: rootState.valid(),
      filled: rootState.filled(),
      focused: rootState.focused(),
      validating: rootState.validating(),
      checked: rootState.checked(),
      readOnly: rootState.readOnly(),
      required: rootState.required(),
    };
  }

  if (typeof children === "function" && children.length >= 1) {
    const render = children as (state: RadioRootState) => JSX.Element;
    // The thunk runs later under the renderer's owner, so re-enter this owner
    // to keep the root context (and disposal) visible to the rendered parts.
    const owner = getOwner();

    return () => {
      // Subscribe the binding: the render below runs untracked under the owner.
      const state = snapshot();

      return runWithOwner(owner, () => render(state));
    };
  }

  return children as JSX.Element;
}

export interface RadioRootState extends FieldRootState {
  /**
   * Whether the radio button is currently selected.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly: boolean;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required: boolean;
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

export type RadioRootProps<Value = any, T extends JSX.ElementType = "span"> = RadioRootOwnProps<Value> &
  ButtonEventHandlers &
  Omit<RebaseUIComponentProps<T, RadioRootState>, "value">;

export namespace RadioRoot {
  export type State = RadioRootState;
  export type Props<Value = any, T extends JSX.ElementType = "span"> = RadioRootProps<Value, T>;
  export type OwnProps<Value = any> = RadioRootOwnProps<Value>;
}
