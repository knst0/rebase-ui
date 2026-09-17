import type { ValidComponent } from "@solidjs/web";
import { createSignal, createUniqueId, onCleanup, Show, untrack } from "solid-js";

import type { FieldRootState } from "../../field/root/FieldRoot";
import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { DEFAULT_FIELD_STATE_ATTRIBUTES, fieldValidityMapping } from "../../internals/field-constants";
import { DEFAULT_FIELD_ROOT_CONTEXT, FieldRootContext, useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import type { Side } from "../../internals/floating/types";
import { stopEvent } from "../../internals/floating/utils/event";
import { useLabelableContext } from "../../internals/labelable-provider/LabelableContext";
import { mergeRefs } from "../../internals/mergeRefs";
import { RenderElement } from "../../internals/render-element";
import { split } from "../../internals/split";
import type { StateAttributesMapping } from "../../internals/stateToAttributes";
import type { RebaseUIComponentProps } from "../../internals/types";
import { visuallyHiddenInput } from "../../internals/utils/visuallyHidden";
import { useComboboxChipsContext, type ComboboxChipsContext } from "../chips/ComboboxChipsContext";
import { useComboboxPositionerContext } from "../positioner/ComboboxPositionerContext";
import { useComboboxDerivedItemsContext, useComboboxInputValueContext, useComboboxRootContext } from "../root/ComboboxRootContext";
import * as ComboboxInputDataAttributes from "./ComboboxInputDataAttributes";

const comboboxInputStateMapping: StateAttributesMapping<ComboboxInputState> = {
  ...fieldValidityMapping,
  open: {
    keys: [ComboboxInputDataAttributes.popupOpen],
    map: (value) => (value ? { [ComboboxInputDataAttributes.popupOpen]: "" } : null),
  },
  popupSide: {
    keys: [ComboboxInputDataAttributes.popupSide],
    map: (value: Side | null) => (value ? { [ComboboxInputDataAttributes.popupSide]: value } : null),
  },
  listEmpty: {
    keys: [ComboboxInputDataAttributes.listEmpty],
    map: (value) => (value ? { [ComboboxInputDataAttributes.listEmpty]: "" } : null),
  },
};

type EventHandlerValue = ((event: never) => void) | undefined;

function callHandler(value: unknown, event: Event): void {
  if (typeof value === "function") {
    (value as (event: Event) => void)(event);
  }
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

function isGecko(): boolean {
  return typeof navigator !== "undefined" && /gecko\/\d/i.test(navigator.userAgent) && !/like gecko/i.test(navigator.userAgent);
}

function getDirection(input: HTMLInputElement): "ltr" | "rtl" {
  const doc = input.ownerDocument;
  const dirElement = input.closest("[dir]") ?? doc?.documentElement;
  return dirElement?.getAttribute("dir") === "rtl" ? "rtl" : "ltr";
}

/**
 * The arrow keys that move the chip highlight backwards and forwards, in that order.
 */
function getChipNavigationKeys(direction: "ltr" | "rtl") {
  return direction === "rtl" ? (["ArrowRight", "ArrowLeft"] as const) : (["ArrowLeft", "ArrowRight"] as const);
}

/**
 * Where the highlight lands once the chip at `index` is removed, or `undefined` for no highlight.
 */
function getIndexAfterChipRemoval(index: number, chipCount: number): number | undefined {
  const nextIndex = index >= chipCount - 1 ? chipCount - 2 : index;
  return nextIndex >= 0 ? nextIndex : undefined;
}

/**
 * Commits the highlighted item by clicking it, tagging the originating event so the item's
 * handler can attribute the selection to it.
 */
function clickHighlightedItem(
  listRef: { current: Array<HTMLElement | null> },
  selectionEventRef: { current: KeyboardEvent | MouseEvent | PointerEvent | null },
  activeIndex: number,
  nativeEvent: KeyboardEvent,
) {
  const listItem = listRef.current[activeIndex];
  if (listItem) {
    selectionEventRef.current = nativeEvent;
    listItem.click();
    selectionEventRef.current = null;
  }
}

/**
 * A visually hidden button that closes the popup when tabbed to, keeping focus
 * trapped while the popup is open in modal contexts.
 */
function InternalDismissButton(props: { ref: (element: HTMLSpanElement | null) => void }) {
  const store = useComboboxRootContext();

  const { getButtonProps, buttonRef } = createButton({ native: false });

  function handleDismiss(event: MouseEvent | KeyboardEvent) {
    store.context.setOpen(false, createChangeEventDetails(REASONS.closePress, event, event.currentTarget as Element));
  }

  return (
    <span
      ref={mergeRefs(props.ref, buttonRef)}
      {...getButtonProps({ onClick: handleDismiss })}
      aria-label="Dismiss"
      style={visuallyHiddenInput}
    />
  );
}

/**
 * A text input to search for items in the list.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxInput<T extends ValidComponent = "input">(props: ComboboxInput.Props<T>) {
  const [local, userHandlers, elementProps] = split(
    props as ComboboxInput.Props,
    { default: defaultProps },
    ["as", "disabled", "id"],
    ["onFocus", "onBlur", "onInput", "onChange", "onKeyDown", "onCompositionStart", "onCompositionEnd", "onPointerMove", "onPointerDown"],
  );
  const as = untrack(() => local.as);
  const idProp = untrack(() => local.id);

  const field = useFieldRootContext();
  const { labelId: fieldLabelId } = useLabelableContext();
  const chips = useComboboxChipsContext() as ComboboxChipsContext | null | undefined;
  const positioning = useComboboxPositionerContext(true);
  const hasPositionerParent = positioning != null;
  const store = useComboboxRootContext();
  // `inputValue` can't be placed in the store.
  const inputValue = useComboboxInputValueContext();

  const disabled = () => field.disabled() === true || (store.select("disabled") as boolean) === true || local.disabled === true;

  const autoHighlightEnabled = () => Boolean(store.select("autoHighlight") as string | false);

  const isInsidePopup = () => hasPositionerParent || (store.select("inline") as boolean) === true;

  const generatedId = createUniqueId();

  const [composingValue, setComposingValue] = createSignal<string | null>(null);
  let isComposing = false;
  let lastActiveIndex: number | null = null;
  let shouldRestoreActiveIndex = false;

  onCleanup(() => {
    isComposing = false;
  });

  function clearHighlight() {
    const keyboardActive = store.context.keyboardActiveRef.current;
    store.context.setIndices({
      activeIndex: null,
      selectedIndex: null,
      type: keyboardActive ? REASONS.keyboard : REASONS.pointer,
    });
  }

  function markPointerActive() {
    store.context.keyboardActiveRef.current = false;
  }

  const state: ComboboxInputState = {
    ...(hasPositionerParent ? DEFAULT_FIELD_STATE_ATTRIBUTES : field.state),
    get open() {
      return store.select("open") as boolean;
    },
    get disabled() {
      return disabled;
    },
    get popupSide() {
      const mounted = store.select("mounted") as boolean;
      const positionerElement = store.select("positionerElement") as HTMLElement | null;
      return mounted && positionerElement ? (store.select("popupSide") as Side | null) : null;
    },
    get listEmpty() {
      return useComboboxDerivedItemsContext().filteredItems.length === 0;
    },
    get readOnly() {
      return store.select("readOnly") as boolean;
    },
  };

  function handleChipKeyDown(event: KeyboardEvent & { currentTarget: HTMLInputElement }): number | undefined {
    if (!chips) {
      return undefined;
    }

    let nextIndex: number | undefined;

    const highlightedChipIndex = chips.highlightedChipIndex();
    const renderedChipsCount = chips.chipsRef.current.length;
    const selectedValue = store.peek("selectedValue") as unknown;
    const [previousChipKey, nextChipKey] = getChipNavigationKeys(getDirection(event.currentTarget));

    if (highlightedChipIndex !== undefined) {
      if (event.key === previousChipKey) {
        event.preventDefault();
        if (highlightedChipIndex > 0) {
          nextIndex = highlightedChipIndex - 1;
        } else {
          nextIndex = undefined;
        }
      } else if (event.key === nextChipKey) {
        event.preventDefault();
        if (highlightedChipIndex < renderedChipsCount - 1) {
          nextIndex = highlightedChipIndex + 1;
        } else {
          nextIndex = undefined;
        }
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        // Move highlight appropriately after removal.
        nextIndex = getIndexAfterChipRemoval(highlightedChipIndex, Array.isArray(selectedValue) ? selectedValue.length : 0);
        clearHighlight();
      }
      return nextIndex;
    }

    // Handle navigation when no chip is highlighted
    if (
      event.key === previousChipKey &&
      (event.currentTarget.selectionStart ?? 0) === 0 &&
      Array.isArray(selectedValue) &&
      selectedValue.length > 0
    ) {
      event.preventDefault();
      nextIndex = renderedChipsCount > 0 ? renderedChipsCount - 1 : undefined;
    }

    return nextIndex;
  }

  function setInputElement(element: HTMLInputElement | null) {
    const nextIsInsidePopup = hasPositionerParent || (store.peek("inline") as boolean) === true;

    if (nextIsInsidePopup && !(store.peek("hasInputValue") as boolean)) {
      store.context.setInputValue("", createChangeEventDetails(REASONS.none));
    }

    store.update({
      inputElement: element,
      inputInsidePopup: nextIsInsidePopup,
      inputOwnsFormValue: (store.peek("selectionMode") as string) === "none" && !hasPositionerParent,
    });
  }

  const ownProps = () => {
    const fromInput = store.select("inputProps") as Record<string, unknown>;
    const fromTrigger = store.select("triggerProps") as Record<string, unknown>;

    const readOnly = store.select("readOnly") as boolean;
    const required = store.select("required") as boolean;
    const selectionMode = store.select("selectionMode") as string;
    const mounted = store.select("mounted") as boolean;
    const inline = store.select("inline") as boolean;
    const autoHighlightMode = store.select("autoHighlight") as string | false;
    const open = store.select("open") as boolean;
    const name = store.select("name") as string | undefined;
    const form = store.select("form") as string | undefined;
    const inputOwnsFormValue = selectionMode === "none" && !hasPositionerParent;

    return {
      ...fromInput,
      ...fromTrigger,
      get value() {
        return composingValue() ?? inputValue();
      },
      get "aria-readonly"() {
        return readOnly ? "true" : undefined;
      },
      get "aria-required"() {
        return required ? "true" : undefined;
      },
      get "aria-labelledby"() {
        return fieldLabelId();
      },
      get disabled() {
        return disabled();
      },
      get readOnly() {
        return readOnly;
      },
      get required() {
        return selectionMode === "none" ? required : undefined;
      },
      get form() {
        return form;
      },
      ...(inputOwnsFormValue && name ? { name } : null),
      get id() {
        return idProp ?? (!isInsidePopup() ? (store.select("id") as string | undefined) : undefined) ?? generatedId;
      },
      onFocus: (event: FocusEvent) => {
        callHandler(fromInput.onFocus as EventHandlerValue, event);
        callHandler(fromTrigger.onFocus as EventHandlerValue, event);
        field.setFocused(true);

        if (!inline || !shouldRestoreActiveIndex) {
          callHandler(userHandlers.onFocus as EventHandlerValue, event);
          return;
        }

        shouldRestoreActiveIndex = false;
        const nextActiveIndex = lastActiveIndex;
        const values = store.context.valuesRef.current;

        if (nextActiveIndex == null || !Object.hasOwn(values, nextActiveIndex)) {
          callHandler(userHandlers.onFocus as EventHandlerValue, event);
          return;
        }

        store.context.setIndices({ activeIndex: nextActiveIndex });
        callHandler(userHandlers.onFocus as EventHandlerValue, event);
      },
      onBlur: (event: FocusEvent) => {
        callHandler(fromInput.onBlur as EventHandlerValue, event);
        callHandler(fromTrigger.onBlur as EventHandlerValue, event);
        field.setTouched(true);
        field.setFocused(false);

        const activeIndex = store.peek("activeIndex") as number | null;
        if (inline && activeIndex !== null && autoHighlightMode !== "always") {
          lastActiveIndex = activeIndex;
          shouldRestoreActiveIndex = true;
          store.context.setIndices({ activeIndex: null });
        }

        if (field.validationMode === "onBlur") {
          const valueToValidate = selectionMode === "none" ? inputValue() : store.peek("selectedValue");
          void field.validation.commit(valueToValidate);
        }
        callHandler(userHandlers.onBlur as EventHandlerValue, event);
      },
      onCompositionStart: (event: CompositionEvent) => {
        callHandler(fromInput.onCompositionStart as EventHandlerValue, event);
        callHandler(fromTrigger.onCompositionStart as EventHandlerValue, event);
        if (isAndroid()) {
          callHandler(userHandlers.onCompositionStart as EventHandlerValue, event);
          return;
        }
        isComposing = true;
        setComposingValue((event.currentTarget as HTMLInputElement).value);
        callHandler(userHandlers.onCompositionStart as EventHandlerValue, event);
      },
      onCompositionEnd: (event: CompositionEvent) => {
        callHandler(fromInput.onCompositionEnd as EventHandlerValue, event);
        callHandler(fromTrigger.onCompositionEnd as EventHandlerValue, event);
        isComposing = false;
        const next = (event.currentTarget as HTMLInputElement).value;
        setComposingValue(null);
        store.context.setInputValue(next, createChangeEventDetails(REASONS.inputChange, event));
        callHandler(userHandlers.onCompositionEnd as EventHandlerValue, event);
      },
      onInput: (event: Event & { currentTarget: HTMLInputElement }) => {
        callHandler(fromInput.onInput as EventHandlerValue, event);
        callHandler(fromInput.onChange as EventHandlerValue, event);
        callHandler(fromTrigger.onInput as EventHandlerValue, event);
        callHandler(fromTrigger.onChange as EventHandlerValue, event);
        const currentTarget = event.currentTarget;
        const nativeEvent = event as unknown as InputEvent;
        // Autofill may not provide `inputType` (Chrome) or may report
        // `insertReplacementText` (Firefox).
        const inputType = nativeEvent.inputType;
        const autofillLikeInput = !inputType || inputType === "insertReplacementText";
        // During composition the input is always considered typed into.
        const shouldOpenOnInput = isComposing || !autofillLikeInput;

        const maybeOpenOnInput = (trimmed: string) => {
          if (readOnly || disabled() || !trimmed || !shouldOpenOnInput) {
            return;
          }

          store.context.setOpen(true, createChangeEventDetails(REASONS.inputChange, nativeEvent));
          // When autoHighlight is enabled, keep the highlight (will be set to 0 in root).
          if (!autoHighlightEnabled()) {
            clearHighlight();
          }
        };

        // During IME composition, avoid propagating controlled updates to prevent
        // filtering the options prematurely so `Empty` won't show incorrectly.
        // We can't rely on this check for Android due to how it handles composition
        // events with some keyboards (e.g. Samsung keyboard with predictive text on
        // treats all text as always-composing).
        if (isComposing) {
          const nextVal = currentTarget.value;
          setComposingValue(nextVal);

          if (nextVal === "" && !(store.peek("openOnInputClick") as boolean) && !(store.peek("inputInsidePopup") as boolean)) {
            store.context.setOpen(false, createChangeEventDetails(REASONS.inputClear, nativeEvent));
          }

          const trimmed = nextVal.trim();
          const shouldMaintainHighlight = autoHighlightEnabled() && trimmed !== "";

          maybeOpenOnInput(trimmed);

          if (open && (store.peek("activeIndex") as number | null) !== null && !shouldMaintainHighlight) {
            clearHighlight();
          }

          callHandler(userHandlers.onInput as EventHandlerValue, event);
          return;
        }

        const inputChangeDetails = createChangeEventDetails(REASONS.inputChange, nativeEvent);
        store.context.setInputValue(currentTarget.value, inputChangeDetails);

        if (inputChangeDetails.isCanceled) {
          callHandler(userHandlers.onInput as EventHandlerValue, event);
          return;
        }

        const empty = currentTarget.value === "";
        const clearDetails = createChangeEventDetails(REASONS.inputClear, nativeEvent);

        if (empty && !(store.peek("inputInsidePopup") as boolean)) {
          if (selectionMode === "single") {
            store.context.setSelectedValue(null, clearDetails);
          }

          if (!(store.peek("openOnInputClick") as boolean)) {
            store.context.setOpen(false, clearDetails);
          }
        }

        maybeOpenOnInput(currentTarget.value.trim());

        // When the user types, ensure the list resets its highlight so that
        // virtual focus returns to the input (aria-activedescendant is
        // cleared).
        if (open && (store.peek("activeIndex") as number | null) !== null && !autoHighlightEnabled()) {
          clearHighlight();
        }
        callHandler(userHandlers.onInput as EventHandlerValue, event);
      },
      // Solid fires `onChange` on commit (blur/Enter) rather than per keystroke: it only chains
      // external handlers. Live value logic runs from `onInput` above.
      onChange: (event: Event & { currentTarget: HTMLInputElement }) => {
        callHandler(fromInput.onChange as EventHandlerValue, event);
        callHandler(fromTrigger.onChange as EventHandlerValue, event);
        callHandler(userHandlers.onChange as EventHandlerValue, event);
      },
      onKeyDown: (event: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
        callHandler(fromInput.onKeyDown as EventHandlerValue, event);
        callHandler(fromTrigger.onKeyDown as EventHandlerValue, event);
        if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
          callHandler(userHandlers.onKeyDown as EventHandlerValue, event);
          return;
        }

        // Tracked before the guards so `readOnly` browsing reports keyboard highlight reasons.
        store.context.keyboardActiveRef.current = true;

        if (disabled() || readOnly) {
          // Browsing can highlight an item, and Enter there must not submit the form.
          if (readOnly && event.key === "Enter" && open && (store.peek("activeIndex") as number | null) !== null) {
            stopEvent(event);
          }
          callHandler(userHandlers.onKeyDown as EventHandlerValue, event);
          return;
        }

        const input = event.currentTarget;
        const scrollAmount = input.scrollWidth - input.clientWidth;
        const isRTL = getDirection(input) === "rtl";

        if (event.key === "Home") {
          stopEvent(event);
          const cursor = isGecko() && isRTL ? input.value.length : 0;
          input.setSelectionRange(cursor, cursor);
          input.scrollLeft = 0;
          callHandler(userHandlers.onKeyDown as EventHandlerValue, event);
          return;
        }

        if (event.key === "End") {
          stopEvent(event);
          const cursor = isGecko() && isRTL ? 0 : input.value.length;
          input.setSelectionRange(cursor, cursor);
          input.scrollLeft = isRTL ? -scrollAmount : scrollAmount;
          callHandler(userHandlers.onKeyDown as EventHandlerValue, event);
          return;
        }

        if (!mounted && event.key === "Escape") {
          const selectedValue = store.peek("selectedValue") as unknown;
          const isClear =
            selectionMode === "multiple" && Array.isArray(selectedValue) ? selectedValue.length === 0 : selectedValue === null;

          const details = createChangeEventDetails(REASONS.escapeKey, event);
          const value = selectionMode === "multiple" ? [] : null;
          store.context.setInputValue("", details);
          store.context.setSelectedValue(value, details);

          if (!isClear && !inline && !details.isPropagationAllowed) {
            event.stopPropagation();
          }

          callHandler(userHandlers.onKeyDown as EventHandlerValue, event);
          return;
        }

        // Handle deletion when no chip is highlighted and the input is empty.
        if (
          chips &&
          event.key === "Backspace" &&
          input.value === "" &&
          chips.highlightedChipIndex() === undefined &&
          Array.isArray(store.peek("selectedValue"))
        ) {
          const currentSelected = store.peek("selectedValue") as Array<unknown>;
          const renderedChipsCount = chips.chipsRef.current.length;
          const removalIndex = renderedChipsCount > 0 ? renderedChipsCount - 1 : currentSelected.length - 1;

          const newValue = currentSelected.filter((_, index) => index !== removalIndex);
          // If the removed item was also the active (highlighted) item, clear highlight
          clearHighlight();
          store.context.setSelectedValue(newValue, createChangeEventDetails(REASONS.none, event));
          callHandler(userHandlers.onKeyDown as EventHandlerValue, event);
          return;
        }

        const hadHighlightedChip = chips?.highlightedChipIndex() !== undefined;
        const nextIndex = handleChipKeyDown(event);

        chips?.setHighlightedChipIndex(nextIndex);

        if (nextIndex !== undefined) {
          chips?.chipsRef.current[nextIndex]?.focus();
        } else if (hadHighlightedChip) {
          store.context.inputRef.current?.focus();
        }

        // event.isComposing
        if (event.which === 229) {
          callHandler(userHandlers.onKeyDown as EventHandlerValue, event);
          return;
        }

        if (event.key === "Enter" && open) {
          const activeIndex = store.peek("activeIndex") as number | null;

          if (activeIndex === null) {
            if (inline) {
              callHandler(userHandlers.onKeyDown as EventHandlerValue, event);
              return;
            }

            // Allow form submission when no item is highlighted.
            store.context.setOpen(false, createChangeEventDetails(REASONS.none, event));
            callHandler(userHandlers.onKeyDown as EventHandlerValue, event);
            return;
          }

          stopEvent(event);
          clickHighlightedItem(store.context.listRef, store.context.selectionEventRef, activeIndex, event);
        }
        callHandler(userHandlers.onKeyDown as EventHandlerValue, event);
      },
      onPointerMove: (event: PointerEvent) => {
        markPointerActive();
        callHandler(userHandlers.onPointerMove as EventHandlerValue, event);
      },
      onPointerDown: (event: PointerEvent) => {
        markPointerActive();
        callHandler(userHandlers.onPointerDown as EventHandlerValue, event);
      },
    };
  };

  const refProps = (externalProps: Record<string, unknown>) => ({
    ref: mergeRefs<HTMLInputElement>(
      externalProps.ref as ((element: HTMLInputElement) => void) | undefined,
      (element: HTMLInputElement | null) => {
        store.context.inputRef.current = element;
      },
      setInputElement,
    ),
  });

  const validationProps = (externalProps: Record<string, unknown>) =>
    hasPositionerParent ? externalProps : field.validation.getValidationProps(disabled(), externalProps);

  const layers = [ownProps, elementProps, refProps, validationProps];

  // Textually-inline JSX per branch: a shared element const would not receive
  // the field context provided below.
  if (hasPositionerParent) {
    return (
      <>
        <Show when={(store.select("open") as boolean) && (!isInsidePopup() || (store.select("modal") as boolean))}>
          <InternalDismissButton
            ref={(element) => {
              store.context.startDismissRef.current = element;
            }}
          />
        </Show>
        <FieldRootContext value={DEFAULT_FIELD_ROOT_CONTEXT}>
          <RenderElement as={as} state={state} props={layers} stateAttributesMapping={comboboxInputStateMapping} />
        </FieldRootContext>
      </>
    );
  }

  return (
    <>
      <Show when={(store.select("open") as boolean) && (!isInsidePopup() || (store.select("modal") as boolean))}>
        <InternalDismissButton
          ref={(element) => {
            store.context.startDismissRef.current = element;
          }}
        />
      </Show>
      <RenderElement as={as} state={state} props={layers} stateAttributesMapping={comboboxInputStateMapping} />
    </>
  );
}

const defaultProps = Object.freeze({
  as: "input",
  disabled: false,
} satisfies Partial<ComboboxInput.Props>);

export interface ComboboxInputState extends FieldRootState {
  /**
   * Whether the corresponding popup is open.
   */
  open: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
}

export interface ComboboxInputOwnProps {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type ComboboxInputProps<T extends ValidComponent = "input"> = ComboboxInputOwnProps & RebaseUIComponentProps<T, ComboboxInputState>;

export namespace ComboboxInput {
  export type State = ComboboxInputState;
  export type Props<T extends ValidComponent = "input"> = ComboboxInputProps<T>;
}
