import { createUniqueId, dynamicElement, omitProps, onCleanup, store as createStore, type JSX } from "reze-js";

import type { FieldRootState } from "../../field/root/FieldRoot";
import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { DEFAULT_FIELD_STATE_ATTRIBUTES, getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { createSetFieldFocused } from "../../internals/field-root-context/createSetFieldFocused";
import { DEFAULT_FIELD_ROOT_CONTEXT, FieldRootContext, useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import type { Side } from "../../internals/floating/types";
import { stopEvent } from "../../internals/floating/utils/event";
import { useLabelableContext } from "../../internals/labelable-provider/LabelableContext";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, RebaseUIComponentProps } from "../../internals/types";
import { getHighlightReason } from "../../internals/utils/getHighlightReason";
import { visuallyHiddenInput } from "../../internals/utils/visuallyHidden";
import { useComboboxChipsContext, type ComboboxChipsContext } from "../chips/ComboboxChipsContext";
import { useComboboxPositionerContext } from "../positioner/ComboboxPositionerContext";
import { useComboboxDerivedItemsContext, useComboboxInputValueContext, useComboboxRootContext } from "../root/ComboboxRootContext";

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

  function handleDismiss(event: MouseEvent) {
    store.context.setOpen(false, createChangeEventDetails(REASONS.closePress, event, event.currentTarget as Element));
  }

  const button = createButton({ nativeButton: false, onClick: handleDismiss });

  return (
    <span
      ref={mergeRefs(props.ref, button.buttonRef)}
      // Spread: the static checker does not list `role` for `span`, but the runtime renders it.
      {...{ role: "button" }}
      tabindex={button.tabIndex}
      aria-disabled={button.ariaDisabled}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
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
export function ComboboxInput<T extends JSX.ElementType = "input">(props: ComboboxInput.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "disabled",
    "id",
    "onFocus",
    "onBlur",
    "onInput",
    "onChange",
    "onKeyDown",
    "onCompositionStart",
    "onCompositionEnd",
    "onPointerMove",
    "onPointerDown",
    "onPointerEnter",
    "onMouseDown",
    "onClick",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;
  const idProp = props.id;

  const field = useFieldRootContext();
  const { labelId: fieldLabelId } = useLabelableContext();
  const chips = useComboboxChipsContext() as ComboboxChipsContext | null | undefined;
  const positioning = useComboboxPositionerContext(true);
  const hasPositionerParent = positioning != null;
  const store = useComboboxRootContext();
  // `inputValue` can't be placed in the store.
  const inputValue = useComboboxInputValueContext();
  const derivedItems = useComboboxDerivedItemsContext();

  function disabled() {
    return field.disabled() === true || (store.select("disabled") as boolean) === true || props.disabled === true;
  }

  const setFocused = createSetFieldFocused(disabled, () => store.context.inputRef.current);

  function autoHighlightEnabled() {
    return Boolean(store.select("autoHighlight") as string | false);
  }

  function isInsidePopup() {
    return hasPositionerParent || (store.select("inline") as boolean) === true;
  }

  const generatedId = createUniqueId();

  const composingState = createStore({ composingValue: null as string | null });
  function composingValue() {
    return composingState.composingValue;
  }
  function setComposingValue(next: string | null) {
    composingState.composingValue = next;
  }
  let isComposing = false;
  let lastActiveIndex: number | null = null;
  let shouldRestoreActiveIndex = false;

  onCleanup(() => {
    isComposing = false;
  });

  function clearHighlight(event: Event) {
    store.context.setIndices({
      activeIndex: null,
      selectedIndex: null,
      type: getHighlightReason(event),
      event,
    });
  }

  const selectors: FieldRootStateSelectors = hasPositionerParent
    ? { ...DEFAULT_FIELD_STATE_ATTRIBUTES, disabled }
    : { ...field.state, disabled };

  function open() {
    return store.select("open") as boolean;
  }

  function readOnly() {
    return store.select("readOnly") as boolean;
  }

  function popupSide(): Side | null {
    const mounted = store.select("mounted") as boolean;
    const positionerElement = store.select("positionerElement") as HTMLElement | null;
    return mounted && positionerElement ? (store.select("popupSide") as Side | null) : null;
  }

  function listEmpty() {
    return derivedItems.filteredItems.length === 0;
  }

  function snapshot(): ComboboxInputState {
    return {
      ...getFieldStateSnapshot(selectors),
      open: open(),
      popupSide: popupSide(),
      listEmpty: listEmpty(),
      readOnly: readOnly(),
    };
  }

  function handleChipKeyDown(event: KeyboardEvent & { currentTarget: HTMLInputElement }): number | undefined {
    if (!chips) {
      return undefined;
    }

    let nextIndex: number | undefined;
    const renderedChipsCount = chips.chipsRef.current.length;
    const selectedValue = store.peek("selectedValue") as unknown;
    const [previousChipKey] = getChipNavigationKeys(getDirection(event.currentTarget));

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

  function fromInput(): Record<string, unknown> {
    return store.select("inputProps") as Record<string, unknown>;
  }

  function fromTrigger(): Record<string, unknown> {
    return store.select("triggerProps") as Record<string, unknown>;
  }

  function mergedInteractionProp(key: string): unknown {
    return fromTrigger()[key] ?? fromInput()[key];
  }

  function handleFocus(event: FocusEvent) {
    callHandler(fromInput().onFocus as EventHandlerValue, event);
    callHandler(fromTrigger().onFocus as EventHandlerValue, event);
    setFocused(true);

    const inline = store.select("inline") as boolean;
    if (!inline || !shouldRestoreActiveIndex) {
      callHandler(props.onFocus as EventHandlerValue, event);
      return;
    }

    shouldRestoreActiveIndex = false;
    const nextActiveIndex = lastActiveIndex;
    const values = store.context.valuesRef.current;

    if (nextActiveIndex == null || !Object.hasOwn(values, nextActiveIndex)) {
      callHandler(props.onFocus as EventHandlerValue, event);
      return;
    }

    store.context.setIndices({ activeIndex: nextActiveIndex });
    callHandler(props.onFocus as EventHandlerValue, event);
  }

  function handleBlur(event: FocusEvent) {
    callHandler(fromInput().onBlur as EventHandlerValue, event);
    callHandler(fromTrigger().onBlur as EventHandlerValue, event);
    field.setTouched(true);
    setFocused(false);

    const inline = store.select("inline") as boolean;
    const autoHighlightMode = store.select("autoHighlight") as string | false;
    const activeIndex = store.peek("activeIndex") as number | null;
    if (inline && activeIndex !== null && autoHighlightMode !== "always") {
      lastActiveIndex = activeIndex;
      shouldRestoreActiveIndex = true;
      store.context.setIndices({ activeIndex: null });
    }

    const selectionMode = store.select("selectionMode") as string;
    if (field.validationMode === "onBlur") {
      const valueToValidate = selectionMode === "none" ? inputValue() : store.peek("selectedValue");
      void field.validation.commit(valueToValidate);
    }
    callHandler(props.onBlur as EventHandlerValue, event);
  }

  function handleCompositionStart(event: CompositionEvent) {
    callHandler(fromInput().onCompositionStart as EventHandlerValue, event);
    callHandler(fromTrigger().onCompositionStart as EventHandlerValue, event);
    if (isAndroid()) {
      callHandler(props.onCompositionStart as EventHandlerValue, event);
      return;
    }
    isComposing = true;
    setComposingValue((event.currentTarget as HTMLInputElement).value);
    callHandler(props.onCompositionStart as EventHandlerValue, event);
  }

  function handleCompositionEnd(event: CompositionEvent) {
    callHandler(fromInput().onCompositionEnd as EventHandlerValue, event);
    callHandler(fromTrigger().onCompositionEnd as EventHandlerValue, event);
    isComposing = false;
    const next = (event.currentTarget as HTMLInputElement).value;
    setComposingValue(null);
    store.context.setInputValue(next, createChangeEventDetails(REASONS.inputChange, event));
    callHandler(props.onCompositionEnd as EventHandlerValue, event);
  }

  function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
    callHandler(fromInput().onInput as EventHandlerValue, event);
    callHandler(fromInput().onChange as EventHandlerValue, event);
    callHandler(fromTrigger().onInput as EventHandlerValue, event);
    callHandler(fromTrigger().onChange as EventHandlerValue, event);
    const currentTarget = event.currentTarget;
    const nativeEvent = event as unknown as InputEvent;
    // Autofill may not provide `inputType` (Chrome) or may report
    // `insertReplacementText` (Firefox).
    const inputType = nativeEvent.inputType;
    const autofillLikeInput = !inputType || inputType === "insertReplacementText";
    // During composition the input is always considered typed into.
    const shouldOpenOnInput = isComposing || !autofillLikeInput;

    const selectionMode = store.select("selectionMode") as string;
    const isOpen = store.select("open") as boolean;

    const maybeOpenOnInput = (trimmed: string) => {
      if (readOnly() || disabled() || !trimmed || !shouldOpenOnInput) {
        return;
      }

      store.context.setOpen(true, createChangeEventDetails(REASONS.inputChange, nativeEvent));
      // When autoHighlight is enabled, keep the highlight (will be set to 0 in root).
      if (!autoHighlightEnabled()) {
        clearHighlight(nativeEvent);
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

      if (isOpen && (store.peek("activeIndex") as number | null) !== null && !shouldMaintainHighlight) {
        clearHighlight(nativeEvent);
      }

      callHandler(props.onInput as EventHandlerValue, event);
      return;
    }

    const inputChangeDetails = createChangeEventDetails(REASONS.inputChange, nativeEvent);
    store.context.setInputValue(currentTarget.value, inputChangeDetails);

    if (inputChangeDetails.isCanceled) {
      callHandler(props.onInput as EventHandlerValue, event);
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
    if (isOpen && (store.peek("activeIndex") as number | null) !== null && !autoHighlightEnabled()) {
      clearHighlight(nativeEvent);
    }
    callHandler(props.onInput as EventHandlerValue, event);
  }

  // Reze fires `onChange` per keystroke like `onInput` for text inputs; the Solid layer
  // only chains external handlers here since live value logic runs from `onInput` above.
  function handleChange(event: Event & { currentTarget: HTMLInputElement }) {
    callHandler(fromInput().onChange as EventHandlerValue, event);
    callHandler(fromTrigger().onChange as EventHandlerValue, event);
    callHandler(props.onChange as EventHandlerValue, event);
  }

  function handleKeyDown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    callHandler(fromInput().onKeyDown as EventHandlerValue, event);
    callHandler(fromTrigger().onKeyDown as EventHandlerValue, event);
    if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
      callHandler(props.onKeyDown as EventHandlerValue, event);
      return;
    }

    const isOpen = store.select("open") as boolean;
    const mounted = store.select("mounted") as boolean;
    const inline = store.select("inline") as boolean;
    const selectionMode = store.select("selectionMode") as string;

    if (disabled() || readOnly()) {
      // Browsing can highlight an item, and Enter there must not submit the form.
      if (readOnly() && event.key === "Enter" && isOpen && (store.peek("activeIndex") as number | null) !== null) {
        stopEvent(event);
      }
      callHandler(props.onKeyDown as EventHandlerValue, event);
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
      callHandler(props.onKeyDown as EventHandlerValue, event);
      return;
    }

    if (event.key === "End") {
      stopEvent(event);
      const cursor = isGecko() && isRTL ? 0 : input.value.length;
      input.setSelectionRange(cursor, cursor);
      input.scrollLeft = isRTL ? -scrollAmount : scrollAmount;
      callHandler(props.onKeyDown as EventHandlerValue, event);
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

      callHandler(props.onKeyDown as EventHandlerValue, event);
      return;
    }

    // Handle deletion when the input is empty.
    const selectedValueForChips = store.peek("selectedValue") as unknown;
    if (
      chips &&
      event.key === "Backspace" &&
      input.value === "" &&
      Array.isArray(selectedValueForChips) &&
      selectedValueForChips.length > 0
    ) {
      const currentSelected = selectedValueForChips as Array<unknown>;
      const renderedChipsCount = chips.chipsRef.current.length;
      const removalIndex = renderedChipsCount > 0 ? renderedChipsCount - 1 : currentSelected.length - 1;

      const newValue = currentSelected.filter((_, index) => index !== removalIndex);
      // If the removed item was also the active (highlighted) item, clear highlight
      clearHighlight(event);
      store.context.setSelectedValue(newValue, createChangeEventDetails(REASONS.none, event));
      callHandler(props.onKeyDown as EventHandlerValue, event);
      return;
    }

    const nextIndex = handleChipKeyDown(event);

    if (nextIndex !== undefined) {
      chips?.chipsRef.current[nextIndex]?.focus();
    }

    // event.isComposing
    if (event.which === 229) {
      callHandler(props.onKeyDown as EventHandlerValue, event);
      return;
    }

    if (event.key === "Enter" && isOpen) {
      const activeIndex = store.peek("activeIndex") as number | null;

      if (activeIndex === null) {
        if (inline) {
          callHandler(props.onKeyDown as EventHandlerValue, event);
          return;
        }

        // Allow form submission when no item is highlighted.
        store.context.setOpen(false, createChangeEventDetails(REASONS.none, event));
        callHandler(props.onKeyDown as EventHandlerValue, event);
        return;
      }

      stopEvent(event);
      clickHighlightedItem(store.context.listRef, store.context.selectionEventRef, activeIndex, event);
    }
    callHandler(props.onKeyDown as EventHandlerValue, event);
  }

  // Interaction handlers dropped here (matching the Solid layer, where the own props
  // override the interaction spreads): only the user handler runs.
  function handlePointerMove(event: PointerEvent) {
    callHandler(props.onPointerMove as EventHandlerValue, event);
  }

  function handlePointerDown(event: PointerEvent) {
    callHandler(props.onPointerDown as EventHandlerValue, event);
  }

  // Non-split user handlers replace the interaction handlers (matching the Solid layer,
  // where `elementProps` override the interaction spreads).
  function handlePointerEnter(event: PointerEvent) {
    const user = props.onPointerEnter as ((event: PointerEvent) => void) | undefined;
    if (user) {
      user(event);
    } else {
      callHandler(fromInput().onPointerEnter as EventHandlerValue, event);
    }
  }

  function handleMouseDown(event: MouseEvent) {
    const user = props.onMouseDown as ((event: MouseEvent) => void) | undefined;
    if (user) {
      user(event);
    } else {
      callHandler(fromInput().onMouseDown as EventHandlerValue, event);
    }
  }

  function handleClick(event: MouseEvent) {
    const user = props.onClick as ((event: MouseEvent) => void) | undefined;
    if (user) {
      user(event);
    } else {
      // The trigger props spread wins over the input props (matching the Solid layer,
      // where `...fromTrigger` follows `...fromInput`): only the open-method recorder runs.
      callHandler(fromTrigger().onClick as EventHandlerValue, event);
    }
  }

  const externalValidationProps: Record<string, any> = {};
  Object.defineProperty(externalValidationProps, "aria-describedby", {
    enumerable: true,
    configurable: true,
    get: () => (props as Record<string, unknown>)["aria-describedby"],
  });
  const validationProps = hasPositionerParent
    ? externalValidationProps
    : (field.validation.getValidationProps(disabled, externalValidationProps) as Record<string, unknown>);

  function showDismissButton() {
    return (store.select("open") as boolean) && (!isInsidePopup() || (store.select("modal") as boolean));
  }

  function inputId(): string {
    return idProp ?? (!isInsidePopup() ? (store.select("id") as string | undefined) : undefined) ?? generatedId;
  }

  function inputName(): string | undefined {
    const selectionMode = store.select("selectionMode") as string;
    const inputOwnsFormValue = selectionMode === "none" && !hasPositionerParent;
    const name = store.select("name") as string | undefined;
    return inputOwnsFormValue && name ? name : undefined;
  }

  function inputRequired(): boolean | undefined {
    const selectionMode = store.select("selectionMode") as string;
    return selectionMode === "none" ? ((store.select("required") as boolean) || undefined) : undefined;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "input");

  // Textually-inline JSX per branch: a shared element const would not receive
  // the field context provided below.
  // `as` is resolved once: the default path renders a static `<input>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    if (hasPositionerParent) {
      return (
        <>
          {showDismissButton() && (
            <InternalDismissButton
              ref={(element) => {
                store.context.startDismissRef.current = element;
              }}
            />
          )}
          <FieldRootContext value={DEFAULT_FIELD_ROOT_CONTEXT}>
            <input
        {...(rest as Record<string, unknown>)}
              role={mergedInteractionProp("role") as "combobox" | undefined}
              autocomplete={mergedInteractionProp("autoComplete") as "off" | undefined}
              spellcheck={mergedInteractionProp("spellCheck") as "true" | "false" | undefined}
              autocorrect={mergedInteractionProp("autoCorrect") as "off" | undefined}
              autocapitalize={mergedInteractionProp("autoCapitalize") as "none" | undefined}
              aria-expanded={mergedInteractionProp("aria-expanded") as "true" | "false" | undefined}
              aria-haspopup={mergedInteractionProp("aria-haspopup") as "listbox" | "grid" | undefined}
              aria-controls={mergedInteractionProp("aria-controls") as string | undefined}
              aria-autocomplete={mergedInteractionProp("aria-autocomplete") as "both" | "inline" | "list" | "none" | undefined}
              aria-activedescendant={mergedInteractionProp("aria-activedescendant") as string | undefined}
              value={composingValue() ?? inputValue()}
              aria-readonly={readOnly() ? "true" : undefined}
              aria-required={(store.select("required") as boolean) ? "true" : undefined}
              aria-labelledby={fieldLabelId()}
              aria-describedby={validationProps["aria-describedby"] as string | undefined}
              aria-invalid={validationProps["aria-invalid"] as "true" | undefined}
              bool:disabled={disabled()}
              readonly={readOnly()}
              required={inputRequired()}
              form={store.select("form") as string | undefined}
              name={inputName()}
              id={inputId()}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onInput={handleInput}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerDown}
              onPointerEnter={handlePointerEnter}
              onMouseDown={handleMouseDown}
              onClick={handleClick}
              data-disabled={selectors.disabled() ? "" : undefined}
              data-valid={selectors.valid() === true ? "" : undefined}
              data-invalid={selectors.valid() === false ? "" : undefined}
              data-touched={selectors.touched() ? "" : undefined}
              data-dirty={selectors.dirty() ? "" : undefined}
              data-filled={selectors.filled() ? "" : undefined}
              data-focused={selectors.focused() ? "" : undefined}
              data-validating={selectors.validating() ? "" : undefined}
              data-popup-open={open() ? "" : undefined}
              data-readonly={readOnly() ? "" : undefined}
              data-popup-side={popupSide() ?? undefined}
              data-list-empty={listEmpty() ? "" : undefined}
              class={resolveClassValue(props.class, snapshot())}
              style={resolveStyleValue(props.style, snapshot())}
              ref={mergeRefs(
                props.ref as ((element: HTMLElement | null) => void) | undefined,
                (element: HTMLInputElement | null) => {
                  store.context.inputRef.current = element;
                },
                setInputElement,
              )}
            >
              {resolveChildrenValue(children, snapshot)}
            </input>
          </FieldRootContext>
        </>
      );
    }
    return (
      <>
          {showDismissButton() && (
            <InternalDismissButton
              ref={(element) => {
                store.context.startDismissRef.current = element;
              }}
            />
          )}
        <input
        {...(rest as Record<string, unknown>)}
        role={mergedInteractionProp("role") as "combobox" | undefined}
        autocomplete={mergedInteractionProp("autoComplete") as "off" | undefined}
        spellcheck={mergedInteractionProp("spellCheck") as "true" | "false" | undefined}
        autocorrect={mergedInteractionProp("autoCorrect") as "off" | undefined}
        autocapitalize={mergedInteractionProp("autoCapitalize") as "none" | undefined}
        aria-expanded={mergedInteractionProp("aria-expanded") as "true" | "false" | undefined}
        aria-haspopup={mergedInteractionProp("aria-haspopup") as "listbox" | "grid" | undefined}
        aria-controls={mergedInteractionProp("aria-controls") as string | undefined}
        aria-autocomplete={mergedInteractionProp("aria-autocomplete") as "both" | "inline" | "list" | "none" | undefined}
        aria-activedescendant={mergedInteractionProp("aria-activedescendant") as string | undefined}
        value={composingValue() ?? inputValue()}
        aria-readonly={readOnly() ? "true" : undefined}
        aria-required={(store.select("required") as boolean) ? "true" : undefined}
        aria-labelledby={fieldLabelId()}
        aria-describedby={validationProps["aria-describedby"] as string | undefined}
        aria-invalid={validationProps["aria-invalid"] as "true" | undefined}
        bool:disabled={disabled()}
        readonly={readOnly()}
        required={inputRequired()}
        form={store.select("form") as string | undefined}
        name={inputName()}
        id={inputId()}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onInput={handleInput}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerEnter={handlePointerEnter}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        data-disabled={selectors.disabled() ? "" : undefined}
        data-valid={selectors.valid() === true ? "" : undefined}
        data-invalid={selectors.valid() === false ? "" : undefined}
        data-touched={selectors.touched() ? "" : undefined}
        data-dirty={selectors.dirty() ? "" : undefined}
        data-filled={selectors.filled() ? "" : undefined}
        data-focused={selectors.focused() ? "" : undefined}
        data-validating={selectors.validating() ? "" : undefined}
        data-popup-open={open() ? "" : undefined}
        data-readonly={readOnly() ? "" : undefined}
        data-popup-side={popupSide() ?? undefined}
        data-list-empty={listEmpty() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={mergeRefs(
          props.ref as ((element: HTMLElement | null) => void) | undefined,
          (element: HTMLInputElement | null) => {
            store.context.inputRef.current = element;
          },
          setInputElement,
        )}
      >
        {resolveChildrenValue(children, snapshot)}
      </input>
      </>
    );
  }

  if (hasPositionerParent) {
    return (
      <>
          {showDismissButton() && (
            <InternalDismissButton
              ref={(element) => {
                store.context.startDismissRef.current = element;
              }}
            />
          )}
        <FieldRootContext value={DEFAULT_FIELD_ROOT_CONTEXT}>
          <Tag
        {...(rest as Record<string, unknown>)}
            role={mergedInteractionProp("role") as "combobox" | undefined}
            autocomplete={mergedInteractionProp("autoComplete") as "off" | undefined}
            spellcheck={mergedInteractionProp("spellCheck") as "true" | "false" | undefined}
            autocorrect={mergedInteractionProp("autoCorrect") as "off" | undefined}
            autocapitalize={mergedInteractionProp("autoCapitalize") as "none" | undefined}
            aria-expanded={mergedInteractionProp("aria-expanded") as "true" | "false" | undefined}
            aria-haspopup={mergedInteractionProp("aria-haspopup") as "listbox" | "grid" | undefined}
            aria-controls={mergedInteractionProp("aria-controls") as string | undefined}
            aria-autocomplete={mergedInteractionProp("aria-autocomplete") as "both" | "inline" | "list" | "none" | undefined}
            aria-activedescendant={mergedInteractionProp("aria-activedescendant") as string | undefined}
            value={composingValue() ?? inputValue()}
            aria-readonly={readOnly() ? "true" : undefined}
            aria-required={(store.select("required") as boolean) ? "true" : undefined}
            aria-labelledby={fieldLabelId()}
            aria-describedby={validationProps["aria-describedby"] as string | undefined}
            aria-invalid={validationProps["aria-invalid"] as "true" | undefined}
            bool:disabled={disabled()}
            readonly={readOnly()}
            required={inputRequired()}
            form={store.select("form") as string | undefined}
            name={inputName()}
            id={inputId()}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onInput={handleInput}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerEnter={handlePointerEnter}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            data-disabled={selectors.disabled() ? "" : undefined}
            data-valid={selectors.valid() === true ? "" : undefined}
            data-invalid={selectors.valid() === false ? "" : undefined}
            data-touched={selectors.touched() ? "" : undefined}
            data-dirty={selectors.dirty() ? "" : undefined}
            data-filled={selectors.filled() ? "" : undefined}
            data-focused={selectors.focused() ? "" : undefined}
            data-validating={selectors.validating() ? "" : undefined}
            data-popup-open={open() ? "" : undefined}
            data-readonly={readOnly() ? "" : undefined}
            data-popup-side={popupSide() ?? undefined}
            data-list-empty={listEmpty() ? "" : undefined}
            class={resolveClassValue(props.class, snapshot())}
            style={resolveStyleValue(props.style, snapshot())}
            ref={mergeRefs(
              props.ref as ((element: HTMLElement | null) => void) | undefined,
              (element: HTMLInputElement | null) => {
                store.context.inputRef.current = element;
              },
              setInputElement,
            )}
          >
            {resolveChildrenValue(children, snapshot)}
          </Tag>
        </FieldRootContext>
      </>
    );
  }
  return (
    <>
          {showDismissButton() && (
            <InternalDismissButton
              ref={(element) => {
                store.context.startDismissRef.current = element;
              }}
            />
          )}
      <Tag
        {...(rest as Record<string, unknown>)}
        role={mergedInteractionProp("role") as "combobox" | undefined}
        autocomplete={mergedInteractionProp("autoComplete") as "off" | undefined}
        spellcheck={mergedInteractionProp("spellCheck") as "true" | "false" | undefined}
        autocorrect={mergedInteractionProp("autoCorrect") as "off" | undefined}
        autocapitalize={mergedInteractionProp("autoCapitalize") as "none" | undefined}
        aria-expanded={mergedInteractionProp("aria-expanded") as "true" | "false" | undefined}
        aria-haspopup={mergedInteractionProp("aria-haspopup") as "listbox" | "grid" | undefined}
        aria-controls={mergedInteractionProp("aria-controls") as string | undefined}
        aria-autocomplete={mergedInteractionProp("aria-autocomplete") as "both" | "inline" | "list" | "none" | undefined}
        aria-activedescendant={mergedInteractionProp("aria-activedescendant") as string | undefined}
        value={composingValue() ?? inputValue()}
        aria-readonly={readOnly() ? "true" : undefined}
        aria-required={(store.select("required") as boolean) ? "true" : undefined}
        aria-labelledby={fieldLabelId()}
        aria-describedby={validationProps["aria-describedby"] as string | undefined}
        aria-invalid={validationProps["aria-invalid"] as "true" | undefined}
        bool:disabled={disabled()}
        readonly={readOnly()}
        required={inputRequired()}
        form={store.select("form") as string | undefined}
        name={inputName()}
        id={inputId()}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onInput={handleInput}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerEnter={handlePointerEnter}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        data-disabled={selectors.disabled() ? "" : undefined}
        data-valid={selectors.valid() === true ? "" : undefined}
        data-invalid={selectors.valid() === false ? "" : undefined}
        data-touched={selectors.touched() ? "" : undefined}
        data-dirty={selectors.dirty() ? "" : undefined}
        data-filled={selectors.filled() ? "" : undefined}
        data-focused={selectors.focused() ? "" : undefined}
        data-validating={selectors.validating() ? "" : undefined}
        data-popup-open={open() ? "" : undefined}
        data-readonly={readOnly() ? "" : undefined}
        data-popup-side={popupSide() ?? undefined}
        data-list-empty={listEmpty() ? "" : undefined}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={mergeRefs(
          props.ref as ((element: HTMLElement | null) => void) | undefined,
          (element: HTMLInputElement | null) => {
            store.context.inputRef.current = element;
          },
          setInputElement,
        )}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
    </>
  );
}

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

export type ComboboxInputProps<T extends JSX.ElementType = "input"> = ComboboxInputOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, ComboboxInputState>;

export namespace ComboboxInput {
  export type State = ComboboxInputState;
  export type Props<T extends JSX.ElementType = "input"> = ComboboxInputProps<T>;
}
