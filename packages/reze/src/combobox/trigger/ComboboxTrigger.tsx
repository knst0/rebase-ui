import { dynamicElement, omitProps, onCleanup, store as createStore, type JSX } from "reze-js";

import type { FieldRootState } from "../../field/root/FieldRoot";
import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { getFieldStateSnapshot, type FieldRootStateSelectors } from "../../internals/field-constants";
import { createSetFieldFocused } from "../../internals/field-root-context/createSetFieldFocused";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import type { Side } from "../../internals/floating/types";
import { contains, getTarget } from "../../internals/floating/utils/element";
import { stopEvent } from "../../internals/floating/utils/event";
import { createLabelableId } from "../../internals/labelable-provider/createLabelableId";
import { useLabelableContext } from "../../internals/labelable-provider/LabelableContext";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument } from "../../internals/utils/owner";
import { useComboboxDerivedItemsContext, useComboboxInputValueContext, useComboboxRootContext } from "../root/ComboboxRootContext";

type EventHandlerValue = ((event: never) => void) | undefined;

function callHandler(value: unknown, event: Event): void {
  if (typeof value === "function") {
    (value as (event: Event) => void)(event);
  }
}

function getComboboxPopupId(rootId: string | null | undefined): string | undefined {
  return rootId == null ? undefined : `${rootId}-popup`;
}

function resolveAriaLabelledBy(fieldLabelId: string | undefined, comboboxLabelId: string | undefined): string | undefined {
  const ids = [fieldLabelId, comboboxLabelId].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

const TYPEAHEAD_RESET_MS = 750;

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxTrigger<T extends JSX.ElementType = "button">(props: ComboboxTrigger.Props<T>) {
  const rest = omitProps(
    props,
    "as",
    "disabled",
    "id",
    "nativeButton",
    "onClick",
    "onMouseDown",
    "onPointerDown",
    "onPointerUp",
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
  const idProp = props.id;

  const field = useFieldRootContext();
  const { labelId: fieldLabelId } = useLabelableContext();
  const store = useComboboxRootContext();
  const inputValue = useComboboxInputValueContext();
  const derivedItems = useComboboxDerivedItemsContext();

  function disabled() {
    return field.disabled() === true || (store.select("disabled") as boolean) === true || props.disabled === true;
  }

  function readOnly() {
    return store.select("readOnly") as boolean;
  }

  function inputInsidePopup() {
    return (store.select("inputInsidePopup") as boolean) === true;
  }

  createLabelableId({ id: () => (inputInsidePopup() ? idProp : undefined) });

  // `createButton` has no press source, so the `data-pressed` hook is tracked locally.
  const pressedState = createStore({ pressed: false });
  function pressed() {
    return pressedState.pressed;
  }
  function setPressed(next: boolean) {
    pressedState.pressed = next;
  }

  let triggerElement: HTMLButtonElement | null = null;
  const setFocused = createSetFieldFocused(disabled, () => triggerElement);
  let focusTimeout: ReturnType<typeof setTimeout> | undefined;
  let typeaheadTimeout: ReturnType<typeof setTimeout> | undefined;
  let typeaheadBuffer = "";
  let currentPointerType = "";

  onCleanup(() => {
    clearTimeout(focusTimeout);
    clearTimeout(typeaheadTimeout);
  });

  const button = createButton({
    get disabled() {
      return disabled();
    },
    get nativeButton() {
      return props.nativeButton;
    },
    get onClick() {
      return handleClick;
    },
    get onMouseDown() {
      return handleMouseDownButton;
    },
    get onKeyDown() {
      return handleKeyDownButton;
    },
    get onKeyUp() {
      return props.onKeyUp as ((event: KeyboardEvent) => void) | undefined;
    },
    get onPointerDown() {
      return handlePointerDown;
    },
  });

  function isNativeButton() {
    return props.nativeButton ?? true;
  }

  function triggerRole(): "combobox" | "button" | undefined {
    // The button layer preserves external props (matching the Solid layer, where `getButtonProps`
    // forwards them over its defaults): the own combobox role wins whenever the input is inside
    // the popup; otherwise a non-native button carries the button role.
    if (inputInsidePopup()) {
      return "combobox";
    }
    return isNativeButton() ? undefined : "button";
  }

  const selectors: FieldRootStateSelectors = { ...field.state, disabled };

  function popupSide(): Side | null {
    const mounted = store.select("mounted") as boolean;
    const positionerElement = store.select("positionerElement") as HTMLElement | null;
    return mounted && positionerElement ? (store.select("popupSide") as Side | null) : null;
  }

  function snapshot(): ComboboxTriggerState {
    return {
      ...getFieldStateSnapshot(selectors),
      readOnly: readOnly(),
      open: store.select("open") as boolean,
      pressed: pressed(),
      popupSide: popupSide(),
      listEmpty: derivedItems.filteredItems.length === 0,
      placeholder:
        (store.select("selectionMode") as string) === "none" ? false : !(store.select("hasSelectedValue") as boolean),
    };
  }

  function setTriggerRef(element: HTMLButtonElement | null) {
    triggerElement = element;
    store.set("triggerElement", element);
  }

  function handleFocusOwn() {
    setFocused(true);

    if (disabled()) {
      return;
    }

    clearTimeout(focusTimeout);
    focusTimeout = setTimeout(() => {
      store.context.forceMount();
    }, 0);
  }

  function handleBlurOwn(event: FocusEvent) {
    // If focus is moving into the popup, don't count it as a blur.
    if (contains(store.peek("positionerElement") as HTMLElement | null, event.relatedTarget as Element | null)) {
      return;
    }

    field.setTouched(true);
    setFocused(false);

    if (field.validationMode === "onBlur") {
      const selectionMode = store.peek("selectionMode") as string;
      const valueToValidate = selectionMode === "none" ? inputValue() : store.peek("selectedValue");
      void field.validation.commit(valueToValidate);
    }
  }

  function handleTypeahead(event: KeyboardEvent) {
    // Typeahead on a closed trigger commits a value rather than moving a highlight, so it stays
    // gated on `readOnly`.
    if (
      store.peek("open") ||
      (store.peek("readOnly") as boolean) ||
      (store.peek("disabled") as boolean) ||
      (store.peek("selectionMode") as string) !== "single" ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    if (event.key.length !== 1) {
      return;
    }

    clearTimeout(typeaheadTimeout);
    typeaheadTimeout = setTimeout(() => {
      typeaheadBuffer = "";
    }, TYPEAHEAD_RESET_MS);

    typeaheadBuffer += event.key.toLowerCase();
    const query = typeaheadBuffer;
    const labels = store.context.labelsRef.current;
    const values = store.context.valuesRef.current;
    const selectedIndex = store.peek("selectedIndex") as number | null;
    const start = selectedIndex == null ? 0 : (selectedIndex + 1) % Math.max(labels.length, 1);

    for (let offset = 0; offset < labels.length; offset += 1) {
      const index = (start + offset) % labels.length;
      if (labels[index]?.toLowerCase().startsWith(query)) {
        const nextSelectedValue = values[index];
        if (nextSelectedValue !== undefined) {
          store.context.setSelectedValue(nextSelectedValue, createChangeEventDetails(REASONS.none));
        }
        return;
      }
    }
  }

  function handleMouseDownOwn(event: MouseEvent) {
    if (disabled()) {
      return;
    }

    // Ensure items are registered for initial selection highlight.
    store.context.forceMount();

    if (currentPointerType !== "touch") {
      store.context.inputRef.current?.focus();

      if (!inputInsidePopup()) {
        event.preventDefault();
      }
    }

    if (store.peek("open")) {
      store.context.setOpen(false, createChangeEventDetails(REASONS.triggerPress, event));
      return;
    }

    if (inputInsidePopup()) {
      const doc = ownerDocument(event.currentTarget as Element | null);

      const handleMouseUp = (mouseEvent: MouseEvent) => {
        if (!triggerElement) {
          return;
        }

        const mouseUpTarget = getTarget(mouseEvent) as Element | null;
        const positioner = store.peek("positionerElement") as HTMLElement | null;
        const list = store.peek("listElement") as HTMLElement | null;

        if (contains(triggerElement, mouseUpTarget) || contains(positioner, mouseUpTarget) || contains(list, mouseUpTarget)) {
          return;
        }

        const rect = triggerElement.getBoundingClientRect();
        if (
          mouseEvent.clientX >= rect.left &&
          mouseEvent.clientX <= rect.right &&
          mouseEvent.clientY >= rect.top &&
          mouseEvent.clientY <= rect.bottom
        ) {
          return;
        }

        store.context.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
      };

      doc.addEventListener("mouseup", handleMouseUp, { once: true });
    }
    store.context.setOpen(true, createChangeEventDetails(REASONS.triggerPress, event));
  }

  function handleKeyDownOwn(event: KeyboardEvent) {
    handleTypeahead(event);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      stopEvent(event);
      store.context.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event));
      store.context.inputRef.current?.focus();
    }
  }

  function fromStore(): Record<string, unknown> {
    return store.select("triggerProps") as Record<string, unknown>;
  }

  function handlePointerDown(event: PointerEvent) {
    currentPointerType = event.pointerType;
    if (!disabled()) {
      setPressed(true);
    }
    callHandler(props.onPointerDown as EventHandlerValue, event);
  }

  function handlePointerUp(event: PointerEvent) {
    currentPointerType = event.pointerType;
    setPressed(false);
    callHandler(props.onPointerUp as EventHandlerValue, event);
  }

  function handleFocus(event: FocusEvent) {
    callHandler(fromStore().onFocus as EventHandlerValue, event);
    handleFocusOwn();
    callHandler(props.onFocus as EventHandlerValue, event);
  }

  function handleBlur(event: FocusEvent) {
    callHandler(fromStore().onBlur as EventHandlerValue, event);
    handleBlurOwn(event);
    callHandler(props.onBlur as EventHandlerValue, event);
  }

  function handleMouseDownButton(event: MouseEvent) {
    callHandler(fromStore().onMouseDown as EventHandlerValue, event);
    handleMouseDownOwn(event);
    callHandler(props.onMouseDown as EventHandlerValue, event);
  }

  function handleKeyDownButton(event: KeyboardEvent) {
    callHandler(fromStore().onKeyDown as EventHandlerValue, event);
    handleKeyDownOwn(event);
    callHandler(props.onKeyDown as EventHandlerValue, event);
  }

  function handleClick(event: MouseEvent) {
    callHandler(fromStore().onClick as EventHandlerValue, event);
    callHandler(props.onClick as EventHandlerValue, event);
  }

  const externalValidationProps: Record<string, any> = {};
  Object.defineProperty(externalValidationProps, "aria-describedby", {
    enumerable: true,
    configurable: true,
    get: () => (props as Record<string, unknown>)["aria-describedby"],
  });
  const validationProps = field.validation.getValidationProps(disabled, externalValidationProps) as Record<string, unknown>;

  function triggerId(): string | undefined {
    return inputInsidePopup() ? (idProp ?? (store.select("id") as string | undefined)) : idProp;
  }

  function ariaControls(): string | undefined {
    if (!(store.select("open") as boolean)) {
      return undefined;
    }
    if (inputInsidePopup()) {
      // Fall back to the default id while the popup registers its own (custom ids are stored
      // once the popup mounts), so `aria-controls` is set on the same commit `open` is true.
      return (store.select("popupId") as string | undefined) ?? getComboboxPopupId(store.select("id") as string | undefined);
    }
    return (store.select("listElement") as HTMLElement | null)?.id || undefined;
  }

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  // `as` is resolved once: the default path renders a static `<button>` so
  // updates patch it in place; only a customized `as` keeps the dynamic tag.
  // Keep both branches in sync.
  if (props.as == null) {
    return (
      <button
        {...(rest as Record<string, unknown>)}
        id={triggerId()}
        tabindex={inputInsidePopup() ? 0 : -1}
        role={triggerRole()}
        type={button.type}
        bool:disabled={button.disabled}
        aria-disabled={button.ariaDisabled}
        aria-expanded={(store.select("open") as boolean) ? "true" : "false"}
        aria-haspopup={inputInsidePopup() ? "dialog" : "listbox"}
        aria-controls={ariaControls()}
        aria-required={inputInsidePopup() && (store.select("required") as boolean) ? "true" : undefined}
        aria-readonly={inputInsidePopup() && (store.select("readOnly") as boolean) ? "true" : undefined}
        aria-labelledby={resolveAriaLabelledBy(fieldLabelId(), store.select("labelId") as string | undefined)}
        aria-describedby={validationProps["aria-describedby"] as string | undefined}
        aria-invalid={validationProps["aria-invalid"] as "true" | undefined}
        onPointerDown={button.onPointerDown}
        onPointerUp={handlePointerUp}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseDown={button.onMouseDown}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        onClick={button.onClick}
        data-disabled={selectors.disabled() ? "" : undefined}
        data-valid={selectors.valid() === true ? "" : undefined}
        data-invalid={selectors.valid() === false ? "" : undefined}
        data-touched={selectors.touched() ? "" : undefined}
        data-dirty={selectors.dirty() ? "" : undefined}
        data-filled={selectors.filled() ? "" : undefined}
        data-focused={selectors.focused() ? "" : undefined}
        data-validating={selectors.validating() ? "" : undefined}
        data-popup-open={(store.select("open") as boolean) ? "" : undefined}
        data-pressed={pressed() ? "" : undefined}
        data-readonly={readOnly() ? "" : undefined}
        data-popup-side={popupSide() ?? undefined}
        data-list-empty={derivedItems.filteredItems.length === 0 ? "" : undefined}
        data-placeholder={
          (store.select("selectionMode") as string) === "none" ? undefined : !(store.select("hasSelectedValue") as boolean) ? "" : undefined
        }
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={mergeRefs(
          props.ref as ((element: HTMLElement | null) => void) | undefined,
          button.buttonRef,
          setTriggerRef,
        )}
      >
        {resolveChildrenValue(children, snapshot)}
      </button>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={triggerId()}
      tabindex={inputInsidePopup() ? 0 : -1}
      role={triggerRole()}
      type={button.type}
      bool:disabled={button.disabled}
      aria-disabled={button.ariaDisabled}
      aria-expanded={(store.select("open") as boolean) ? "true" : "false"}
      aria-haspopup={inputInsidePopup() ? "dialog" : "listbox"}
      aria-controls={ariaControls()}
      aria-required={inputInsidePopup() && (store.select("required") as boolean) ? "true" : undefined}
      aria-readonly={inputInsidePopup() && (store.select("readOnly") as boolean) ? "true" : undefined}
      aria-labelledby={resolveAriaLabelledBy(fieldLabelId(), store.select("labelId") as string | undefined)}
      aria-describedby={validationProps["aria-describedby"] as string | undefined}
      aria-invalid={validationProps["aria-invalid"] as "true" | undefined}
      onPointerDown={button.onPointerDown}
      onPointerUp={handlePointerUp}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onClick={button.onClick}
      data-disabled={selectors.disabled() ? "" : undefined}
      data-valid={selectors.valid() === true ? "" : undefined}
      data-invalid={selectors.valid() === false ? "" : undefined}
      data-touched={selectors.touched() ? "" : undefined}
      data-dirty={selectors.dirty() ? "" : undefined}
      data-filled={selectors.filled() ? "" : undefined}
      data-focused={selectors.focused() ? "" : undefined}
      data-validating={selectors.validating() ? "" : undefined}
      data-popup-open={(store.select("open") as boolean) ? "" : undefined}
      data-pressed={pressed() ? "" : undefined}
      data-readonly={readOnly() ? "" : undefined}
      data-popup-side={popupSide() ?? undefined}
      data-list-empty={derivedItems.filteredItems.length === 0 ? "" : undefined}
      data-placeholder={
        (store.select("selectionMode") as string) === "none" ? undefined : !(store.select("hasSelectedValue") as boolean) ? "" : undefined
      }
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={mergeRefs(
        props.ref as ((element: HTMLElement | null) => void) | undefined,
        button.buttonRef,
        setTriggerRef,
      )}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface ComboboxTriggerState extends FieldRootState {
  /**
   * Whether the trigger is read-only.
   */
  readOnly: boolean;
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the trigger is pressed.
   */
  pressed: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the combobox doesn't have a value.
   */
  placeholder: boolean;
}

export interface ComboboxTriggerOwnProps extends NativeButtonProps {
  /**
   * The id of the trigger. Defaults to the root id.
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type ComboboxTriggerProps<T extends JSX.ElementType = "button"> = ComboboxTriggerOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, ComboboxTriggerState>;

export namespace ComboboxTrigger {
  export type State = ComboboxTriggerState;
  export type Props<T extends JSX.ElementType = "button"> = ComboboxTriggerProps<T>;
}
