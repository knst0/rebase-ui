import type { JSX } from "@solidjs/web";
import { For, onSettled, untrack, type Setter } from "solid-js";

import { EMPTY_ARRAY } from "#utils/empty";

import { createChangeEventDetails, REASONS, type RebaseUIChangeEventDetails } from "../../internals/event-details";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { visuallyHidden, visuallyHiddenInput } from "../../internals/utils/visuallyHidden";
import { defaultItemEquality } from "../utils/itemEquality";
import { stringifyAsLabel, stringifyAsValue, type SelectItemsInput } from "../utils/resolveValueLabel";
import { createSelectRoot } from "./createSelectRoot";
import {
  SelectFloatingContext,
  SelectRootContext,
  SelectRootPropsContext,
  type SelectRootPropsContextValue,
} from "./SelectRootContext";

/**
 * Groups all parts of the select.
 * Doesn't render its own HTML element.
 */
export function SelectRoot<Value, Multiple extends boolean | undefined = false>(
  props: SelectRoot.Props<Value, Multiple>,
) {
  const multiple = () => props.multiple ?? false;

  const defaultValue = untrack((): any => {
    if (props.multiple) {
      return (props.defaultValue as SelectValueType<Value, Multiple> | null | undefined) ?? EMPTY_ARRAY;
    }
    return (props.defaultValue as SelectValueType<Value, Multiple> | null | undefined) ?? null;
  });

  const root = createSelectRoot({
    id: () => props.id,
    value: () => props.value as any,
    defaultValue: () => defaultValue,
    open: () => props.open,
    defaultOpen: () => props.defaultOpen ?? false,
    name: () => props.name,
    disabled: () => props.disabled ?? false,
    readOnly: () => props.readOnly ?? false,
    required: () => props.required ?? false,
    modal: () => props.modal ?? true,
    multiple: () => (props.multiple ?? false) as boolean,
    highlightItemOnHover: () => props.highlightItemOnHover ?? true,
    items: () => props.items as SelectItemsInput,
    itemToStringLabel: () => props.itemToStringLabel as ((item: any) => string) | undefined,
    itemToStringValue: () => props.itemToStringValue as ((item: any) => string) | undefined,
    isItemEqualToValue: () =>
      (props.isItemEqualToValue as ((itemValue: any, selectedValue: any) => boolean) | undefined) ??
      defaultItemEquality,
    onValueChange: (value, eventDetails) =>
      (
        props.onValueChange as
          | ((value: any, eventDetails: SelectRoot.ChangeEventDetails) => void)
          | undefined
      )?.(value, eventDetails),
    onOpenChange: (open, eventDetails) => props.onOpenChange?.(open, eventDetails),
    onOpenChangeComplete: (open) => props.onOpenChangeComplete?.(open),
    hasActionsRef: untrack(() => props.actionsRef) !== undefined,
  });

  const field = useFieldRootContext();

  const actionsRef = untrack(() => props.actionsRef);
  if (actionsRef) {
    // Delivering the actions is a signal write, so it happens outside the
    // component's owned scope once rendering has settled.
    onSettled(() => {
      actionsRef({ unmount: root.forceUnmount });

      return () => {
        actionsRef(null);
      };
    });
  }

  const propsContextValue: SelectRootPropsContextValue = {
    get disabled() {
      return root.disabled();
    },
    get readOnly() {
      return props.readOnly ?? false;
    },
    get required() {
      return props.required ?? false;
    },
    get multiple() {
      return props.multiple ?? false;
    },
    get highlightItemOnHover() {
      return props.highlightItemOnHover ?? true;
    },
    itemProps: root.itemProps,
  };

  const mergedInputRef = mergeRefs(untrack(() => props.inputRef), (element: HTMLInputElement) => {
    field.validation.inputElement = element;
  });

  function handleHiddenInputFocus() {
    // Move focus to the trigger element when the hidden input is focused.
    root.store.peek("triggerElement")?.focus({
      // Supported in Chrome from 144 (January 2026)
      focusVisible: true,
    } as FocusOptions);
  }

  function handleAutofillChange(event: Event) {
    // Handle browser autofill.
    if (event.defaultPrevented || root.disabled() || props.readOnly) {
      return;
    }

    const target = event.currentTarget as HTMLInputElement | null;
    const nextValue = target?.value ?? "";
    const details = createChangeEventDetails(REASONS.none, event);

    function handleChange() {
      if (multiple()) {
        // Browser autofill only writes a single scalar value.
        return;
      }

      // Preserve the original serialized matching, then fall back to rendered text,
      // which browsers can autofill for primitive values like
      // `value="US">United States`.
      const nextValueLower = nextValue.toLowerCase();
      const { valuesRef, labelsRef } = root.store.context;
      const itemToStringValue = untrack(() => props.itemToStringValue);
      const itemToStringLabel = untrack(() => props.itemToStringLabel);
      let matchingIndex = valuesRef.current.findIndex(
        (candidate) =>
          stringifyAsValue(candidate, itemToStringValue).toLowerCase() === nextValueLower ||
          stringifyAsLabel(candidate, itemToStringLabel).toLowerCase() === nextValueLower,
      );

      if (matchingIndex === -1) {
        matchingIndex = valuesRef.current.findIndex((_, index) => {
          const renderedLabel = labelsRef.current[index];
          return renderedLabel != null && renderedLabel.toLowerCase() === nextValueLower;
        });
      }

      const matchingValue = valuesRef.current[matchingIndex];
      if (matchingValue != null) {
        // `setValue` may be canceled by `onValueChange`; rely on the value-change effect to
        // mark the field dirty and run validation only when the value actually changes.
        root.store.context.setValue(matchingValue, details as SelectRoot.ChangeEventDetails);
      }
    }

    root.store.set("forceMount", true);
    queueMicrotask(handleChange);
  }

  const hiddenInputName = () => (multiple() ? undefined : root.name());
  const multipleValues = (): Array<any> => {
    const currentValue = root.value();
    return multiple() && Array.isArray(currentValue) ? currentValue : [];
  };

  return (
    <SelectRootContext value={root.store}>
      <SelectRootPropsContext value={propsContextValue}>
        <SelectFloatingContext value={untrack(() => root.store.peek("floatingRootContext"))}>
          {untrack(() => props.children) as JSX.Element}
        </SelectFloatingContext>
      </SelectRootPropsContext>
      <RenderElement
        as="input"
        props={[
          {
            ref: mergedInputRef,
            "aria-hidden": "true",
            tabindex: -1,
            onFocus: handleHiddenInputFocus,
            onChange: handleAutofillChange,
            get id() {
              return root.generatedId() && hiddenInputName() == null
                ? `${root.generatedId()}-hidden-input`
                : undefined;
            },
            get form() {
              return props.form;
            },
            get name() {
              return hiddenInputName();
            },
            get autocomplete() {
              return props.autoComplete;
            },
            get value() {
              return root.serializedValue();
            },
            get disabled() {
              return root.disabled();
            },
            get required() {
              return (props.required ?? false) && !(multiple() && root.hasSelectedValue());
            },
            get readonly() {
              return props.readOnly;
            },
            get style() {
              return root.name() ? visuallyHiddenInput : visuallyHidden;
            },
          },
          (externalProps) => field.validation.getValidationProps(root.disabled(), externalProps),
        ]}
      />
      <For each={multipleValues()}>
        {(itemValue) => (
          <input
            type="hidden"
            form={props.form}
            name={root.name()}
            value={stringifyAsValue(itemValue, untrack(() => props.itemToStringValue))}
            disabled={root.disabled()}
          />
        )}
      </For>
    </SelectRootContext>
  );
}

type SelectValueType<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? Value[]
  : Value;

export interface SelectRootProps<Value, Multiple extends boolean | undefined = false> {
  children?: JSX.Element | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: ((element: HTMLInputElement) => void) | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the select is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Provides a hint to the browser for autofill.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  autoComplete?: string | undefined;
  /**
   * The id of the Select.
   */
  id?: string | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to choose a different option from the select popup.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether multiple items can be selected.
   * @default false
   */
  multiple?: Multiple | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Whether the select popup is initially open.
   *
   * To render a controlled select popup, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Event handler called when the select popup is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: SelectRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the select popup is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the select popup is currently open.
   */
  open?: boolean | undefined;
  /**
   * Determines if the select enters a modal state when open.
   * - `true`: user interaction is limited to the select: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * A signal setter that receives the imperative actions.
   * - `unmount`: Manually unmounts the select.
   * Call this after any externally controlled closing animation finishes.
   */
  actionsRef?: Setter<SelectRootActions | null> | undefined;
  /**
   * Data structure of the items rendered in the select popup.
   * When specified, `<Select.Value>` renders the label of the selected item instead of the raw value.
   * @example
   * ```tsx
   * const items = {
   *   sans: 'Sans-serif',
   *   serif: 'Serif',
   *   mono: 'Monospace',
   *   cursive: 'Cursive',
   * };
   * <Select.Root items={items} />
   * ```
   */
  items?: SelectItemsInput;
  /**
   * When the item values are objects (`<Select.Item value={object}>`), this function converts the object value to a string representation for display in the trigger.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   */
  itemToStringLabel?: ((itemValue: Value) => string) | undefined;
  /**
   * When the item values are objects (`<Select.Item value={object}>`), this function converts the object value to a string representation for form submission.
   * If the shape of the object is `{ value, label }`, the value will be used automatically without needing to specify this prop.
   */
  itemToStringValue?: ((itemValue: Value) => string) | undefined;
  /**
   * Custom comparison logic used to determine if a select item value matches the current selected value. Useful when item values are objects without matching referentially.
   * Defaults to `Object.is` comparison.
   */
  isItemEqualToValue?: ((itemValue: Value, value: Value) => boolean) | undefined;
  /**
   * The uncontrolled value of the select when it's initially rendered.
   *
   * To render a controlled select, use the `value` prop instead.
   */
  defaultValue?: SelectValueType<Value, Multiple> | null | undefined;
  /**
   * The value of the select. Use when controlled.
   */
  value?: SelectValueType<Value, Multiple> | null | undefined;
  /**
   * Event handler called when the value of the select changes.
   */
  onValueChange?:
    | ((
        value: SelectValueType<Value, Multiple> | (Multiple extends true ? never : null),
        eventDetails: SelectRoot.ChangeEventDetails,
      ) => void)
    | undefined;
}

export interface SelectRootState {}

export interface SelectRootActions {
  unmount: () => void;
}

export type SelectRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.windowResize
  | typeof REASONS.itemPress
  | typeof REASONS.focusOut
  | typeof REASONS.listNavigation
  | typeof REASONS.cancelOpen
  | typeof REASONS.none;

export type SelectRootChangeEventDetails = RebaseUIChangeEventDetails<SelectRootChangeEventReason>;

export namespace SelectRoot {
  export type Props<Value, Multiple extends boolean | undefined = false> = SelectRootProps<
    Value,
    Multiple
  >;
  export type State = SelectRootState;
  export type Actions = SelectRootActions;
  export type ChangeEventReason = SelectRootChangeEventReason;
  export type ChangeEventDetails = SelectRootChangeEventDetails;
}
