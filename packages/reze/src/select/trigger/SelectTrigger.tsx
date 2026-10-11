import { dynamicElement, effect, omitProps, onCleanup, store as createStore, type JSX } from "reze-js";

import type { FieldRootState } from "../../field/root/FieldRoot";
import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { createSetFieldFocused } from "../../internals/field-root-context/createSetFieldFocused";
import { useFieldRootContext } from "../../internals/field-root-context/FieldRootContext";
import type { Side } from "../../internals/floating/types";
import { contains, getFloatingFocusElement } from "../../internals/floating/utils/element";
import { createLabelableId } from "../../internals/labelable-provider/createLabelableId";
import { useLabelableContext } from "../../internals/labelable-provider/LabelableContext";
import { mergeRefs } from "../../internals/mergeRefs";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import { ownerDocument } from "../../internals/utils/owner";
import type { SelectRoot } from "../root/SelectRoot";
import { useSelectRootContext } from "../root/SelectRootContext";

const SELECTED_DELAY = 400;

type EventHandlerValue = ((event: never) => void) | undefined;

function callHandler(value: unknown, event: Event): void {
  if (typeof value === "function") {
    (value as (event: Event) => void)(event);
  }
}

/**
 * A button that opens the select popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectTrigger<T extends JSX.ElementType = "button">(props: SelectTrigger.Props<T>) {
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
    "onKeyUp",
    "class",
    "style",
    "children",
    "ref",
  );
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const field = useFieldRootContext();
  const { labelId: fieldLabelId } = useLabelableContext();
  const store = useSelectRootContext();

  const disabled = () => (store.select("disabled") as boolean) || props.disabled === true;
  const isNativeButton = () => props.nativeButton ?? true;

  // Registers an explicit trigger id so field labels point at the trigger.
  // Without one, the root id (already registered by the root) stays in effect.
  createLabelableId({ id: () => props.id ?? undefined, enabled: () => props.id !== undefined });

  // `createButton` has no press source, so the `data-pressed` hook is tracked locally.
  const pressedStore = createStore({ pressed: false });
  function isPressedState(): boolean {
    return pressedStore.pressed;
  }
  function setPressedState(next: boolean): void {
    if (pressedStore.pressed !== next) {
      pressedStore.pressed = next;
    }
  }

  let triggerElement: HTMLButtonElement | null = null;
  const setFocused = createSetFieldFocused(disabled, () => triggerElement);
  let focusTimeout: ReturnType<typeof setTimeout> | undefined;
  let mouseDownTimeout: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    clearTimeout(focusTimeout);
    clearTimeout(mouseDownTimeout);
  });

  const button = createButton({
    get disabled() {
      return disabled();
    },
    get focusableWhenDisabled() {
      return false;
    },
    get nativeButton() {
      return isNativeButton();
    },
    get onClick() {
      return chainHandlers("onClick");
    },
    get onMouseDown() {
      return chainHandlers("onMouseDown");
    },
    get onKeyDown() {
      return chainHandlers("onKeyDown");
    },
    get onKeyUp() {
      return chainHandlers("onKeyUp");
    },
    get onPointerDown() {
      return chainHandlers("onPointerDown");
    },
  });

  effect(() => {
    const isOpen = store.select("open") as boolean;
    if (isOpen) {
      // A mousedown on the trigger can open the popup under the cursor. Keep mouseup selection
      // disabled briefly so releasing over either the selected item or a neighboring item doesn't
      // commit an accidental selection.
      const timeout = setTimeout(() => {
        store.context.selectionRef.current.allowUnselectedMouseUp = true;
        store.context.selectionRef.current.allowSelectedMouseUp = true;
      }, SELECTED_DELAY);
      onCleanup(() => clearTimeout(timeout));
      return;
    }

    store.context.selectionRef.current = {
      allowSelectedMouseUp: false,
      allowUnselectedMouseUp: false,
      dragY: 0,
    };
    clearTimeout(mouseDownTimeout);
  });

  function setTriggerRef(element: HTMLElement | null): void {
    // The trigger renders a button; keep a typed handle for the bounds check below.
    triggerElement = element as HTMLButtonElement | null;
    store.set("triggerElement", element);
  }

  function handleFocus(event: FocusEvent): void {
    setFocused(true);

    // The popup element shouldn't obscure the focused trigger.
    if (store.peek("open") && store.context.alignItemWithTriggerActiveRef.current) {
      store.context.setOpen(false, createChangeEventDetails(REASONS.none, event));
    }

    // Saves a re-render on initial click: `forceMount === true` mounts
    // the items before `open === true`.
    clearTimeout(focusTimeout);
    focusTimeout = setTimeout(() => {
      store.set("forceMount", true);
    }, 0);
  }

  function handleBlur(event: FocusEvent): void {
    // If focus is moving into the popup, don't count it as a blur.
    if (contains(store.peek("positionerElement"), event.relatedTarget as Element | null)) {
      return;
    }

    field.setTouched(true);
    setFocused(false);
    setPressedState(false);

    if (field.validationMode === "onBlur") {
      void field.validation.commit(store.peek("value"));
    }
  }

  function handleMouseDown(event: MouseEvent): void {
    if (store.peek("open")) {
      return;
    }

    const doc = ownerDocument(event.currentTarget as Element | null);

    function handleMouseUp(mouseEvent: MouseEvent): void {
      const trigger = triggerElement;
      if (!trigger) {
        return;
      }

      const mouseUpTarget = mouseEvent.target as Element | null;

      // Don't treat the release as an outside press when it lands on the trigger or inside
      // the popup positioner (or their children).
      if (contains(trigger, mouseUpTarget) || contains(store.peek("positionerElement"), mouseUpTarget)) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const withinBounds =
        mouseEvent.clientX >= rect.left &&
        mouseEvent.clientX <= rect.right &&
        mouseEvent.clientY >= rect.top &&
        mouseEvent.clientY <= rect.bottom;
      if (withinBounds) {
        return;
      }

      store.context.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
    }

    clearTimeout(mouseDownTimeout);
    // Defer the subscription so the mousedown that opens the popup isn't
    // immediately followed by its own mouseup closing it again.
    mouseDownTimeout = setTimeout(() => {
      doc.addEventListener("mouseup", handleMouseUp, { once: true });
    }, 0);
  }

  function handlePointerDown(): void {
    if (!disabled()) {
      setPressedState(true);
    }
  }

  function handlePointerUp(): void {
    setPressedState(false);
  }

  function snapshot(): SelectTriggerState {
    return {
      disabled: disabled(),
      touched: field.state.touched(),
      dirty: field.state.dirty(),
      valid: field.state.valid(),
      filled: field.state.filled(),
      focused: field.state.focused(),
      validating: field.state.validating(),
      open: store.select("open") as boolean,
      pressed: isPressedState(),
      readOnly: store.select("readOnly") as boolean,
      required: store.select("required") as boolean,
      value: store.select("value"),
      popupSide: popupSide(),
      placeholder: !store.select("hasSelectedValue"),
    };
  }

  function popupSide(): Side | null {
    const mounted = store.select("mounted") as boolean;
    const positionerElement = store.select("positionerElement") as HTMLElement | null;
    const side = store.select("popupSide") as Side | null;
    return mounted && positionerElement ? side : null;
  }

  function chainHandlers(key: string): ((event: any) => void) | undefined {
    // In a JSX binding this subscribes the handler to the interaction props; per event
    // (through `createButton`) it only consumes the current props without tracking.
    const fromStore = store.select("triggerProps") as Record<string, any>;
    const user = (props as unknown as Record<string, unknown>)[key] as EventHandlerValue;

    if (key === "onFocus") {
      return (event: FocusEvent) => {
        callHandler(fromStore.onFocus as EventHandlerValue, event);
        handleFocus(event);
        callHandler(user, event);
      };
    }
    if (key === "onBlur") {
      return (event: FocusEvent) => {
        callHandler(fromStore.onBlur as EventHandlerValue, event);
        handleBlur(event);
        callHandler(user, event);
      };
    }
    if (key === "onMouseDown") {
      return (event: MouseEvent) => {
        callHandler(fromStore.onMouseDown as EventHandlerValue, event);
        handleMouseDown(event);
        callHandler(user, event);
      };
    }
    if (key === "onPointerDown") {
      return (event: PointerEvent) => {
        callHandler(fromStore.onPointerDown as EventHandlerValue, event);
        handlePointerDown();
        callHandler(user, event);
      };
    }
    if (key === "onPointerUp") {
      return (event: PointerEvent) => {
        callHandler(fromStore.onPointerUp as EventHandlerValue, event);
        handlePointerUp();
        callHandler(user, event);
      };
    }
    if (key === "onClick") {
      return (event: MouseEvent) => {
        callHandler(fromStore.onClick as EventHandlerValue, event);
        callHandler(user, event);
      };
    }
    if (key === "onKeyDown") {
      return (event: KeyboardEvent) => {
        callHandler(fromStore.onKeyDown as EventHandlerValue, event);
        callHandler(user, event);
      };
    }
    if (key === "onKeyUp") {
      return (event: KeyboardEvent) => {
        callHandler(fromStore.onKeyUp as EventHandlerValue, event);
        callHandler(user, event);
      };
    }
    return undefined;
  }

  function ref(element: HTMLElement | null): void {
    mergeRefs<HTMLElement | null>(
      (props.ref as ((element: HTMLElement | null) => void) | undefined),
      button.buttonRef,
      setTriggerRef,
    )(element);
  }

  const externalValidationProps: Record<string, any> = {};
  Object.defineProperty(externalValidationProps, "aria-describedby", {
    enumerable: true,
    configurable: true,
    get: () => (rest as Record<string, unknown>)["aria-describedby"],
  });
  const validationProps = field.validation.getValidationProps(disabled, externalValidationProps);

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  function triggerId(): string | undefined {
    return props.id ?? (store.select("id") as string | undefined);
  }

  function ariaControls(): string | undefined {
    if (!store.select("open")) {
      return undefined;
    }
    const listElement = store.select("listElement") as HTMLDivElement | null;
    return listElement?.id || getFloatingFocusElement(store.peek("positionerElement") as HTMLElement | null)?.id || undefined;
  }

  function ariaLabelledBy(): string | undefined {
    const ids = [fieldLabelId(), store.select("labelId")].filter(Boolean);
    return ids.length > 0 ? (ids as string[]).join(" ") : undefined;
  }

  // `as` is resolved once: a dynamic element re-creates its DOM node whenever a sibling mounts
  // or unmounts, which would drop the trigger's focus and listeners. The default path renders
  // a static `<button>`; only a customized `as` keeps the dynamic tag. Keep both branches in sync.
  if (props.as == null) {
    return (
      <button
        {...(rest as Record<string, unknown>)}
        id={triggerId()}
        type={button.type}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={(store.select("open") as boolean) ? "true" : "false"}
        aria-controls={ariaControls()}
        aria-labelledby={ariaLabelledBy()}
        aria-readonly={(store.select("readOnly") as boolean) ? "true" : undefined}
        aria-required={(store.select("required") as boolean) ? "true" : undefined}
        aria-describedby={validationProps["aria-describedby"]}
        aria-invalid={validationProps["aria-invalid"]}
        aria-disabled={button.ariaDisabled}
        bool:disabled={isNativeButton() && disabled()}
        tabindex={disabled() ? -1 : 0}
        onClick={button.onClick}
        onMouseDown={button.onMouseDown}
        onPointerDown={button.onPointerDown}
        onPointerUp={chainHandlers("onPointerUp")}
        onFocus={chainHandlers("onFocus")}
        onBlur={chainHandlers("onBlur")}
        onKeyDown={button.onKeyDown}
        onKeyUp={button.onKeyUp}
        data-popup-open={(store.select("open") as boolean) ? "" : undefined}
        data-pressed={isPressedState() ? "" : undefined}
        data-disabled={disabled() ? "" : undefined}
        data-readonly={(store.select("readOnly") as boolean) ? "" : undefined}
        data-required={(store.select("required") as boolean) ? "" : undefined}
        data-popup-side={popupSide() ?? undefined}
        data-valid={field.state.valid() === true ? "" : undefined}
        data-invalid={field.state.valid() === false ? "" : undefined}
        data-touched={field.state.touched() ? "" : undefined}
        data-dirty={field.state.dirty() ? "" : undefined}
        data-filled={field.state.filled() ? "" : undefined}
        data-focused={field.state.focused() ? "" : undefined}
        data-validating={field.state.validating() ? "" : undefined}
        data-placeholder={(store.select("hasSelectedValue") as boolean) ? undefined : ""}
        class={resolveClassValue(props.class, snapshot())}
        style={resolveStyleValue(props.style, snapshot())}
        ref={ref}
      >
        {resolveChildrenValue(children, snapshot)}
      </button>
    );
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      id={triggerId()}
      type={button.type}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={(store.select("open") as boolean) ? "true" : "false"}
      aria-controls={ariaControls()}
      aria-labelledby={ariaLabelledBy()}
      aria-readonly={(store.select("readOnly") as boolean) ? "true" : undefined}
      aria-required={(store.select("required") as boolean) ? "true" : undefined}
      aria-describedby={validationProps["aria-describedby"]}
      aria-invalid={validationProps["aria-invalid"]}
      aria-disabled={button.ariaDisabled}
      bool:disabled={isNativeButton() && disabled()}
      tabindex={disabled() ? -1 : 0}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onPointerDown={button.onPointerDown}
      onPointerUp={chainHandlers("onPointerUp")}
      onFocus={chainHandlers("onFocus")}
      onBlur={chainHandlers("onBlur")}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      data-popup-open={(store.select("open") as boolean) ? "" : undefined}
      data-pressed={isPressedState() ? "" : undefined}
      data-disabled={disabled() ? "" : undefined}
      data-readonly={(store.select("readOnly") as boolean) ? "" : undefined}
      data-required={(store.select("required") as boolean) ? "" : undefined}
      data-popup-side={popupSide() ?? undefined}
      data-valid={field.state.valid() === true ? "" : undefined}
      data-invalid={field.state.valid() === false ? "" : undefined}
      data-touched={field.state.touched() ? "" : undefined}
      data-dirty={field.state.dirty() ? "" : undefined}
      data-filled={field.state.filled() ? "" : undefined}
      data-focused={field.state.focused() ? "" : undefined}
      data-validating={field.state.validating() ? "" : undefined}
      data-placeholder={(store.select("hasSelectedValue") as boolean) ? undefined : ""}
      class={resolveClassValue(props.class, snapshot())}
      style={resolveStyleValue(props.style, snapshot())}
      ref={ref}
    >
      {resolveChildrenValue(children, snapshot)}
    </Tag>
  );
}

export interface SelectTriggerState extends FieldRootState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
  /**
   * Whether the trigger is pressed.
   */
  pressed: boolean;
  /**
   * Whether the select popup is readonly.
   */
  readOnly: boolean;
  /**
   * Whether a value is required for form submission.
   */
  required: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * The value of the currently selected item.
   */
  value: unknown;
  /**
   * Whether the select doesn't have a value.
   */
  placeholder: boolean;
}

export interface SelectTriggerOwnProps extends NativeButtonProps {
  /**
   * The id of the trigger. Defaults to the root id.
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
}

export type SelectTriggerProps<T extends JSX.ElementType = "button"> = SelectTriggerOwnProps &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, SelectTriggerState>;

export namespace SelectTrigger {
  export type State = SelectTriggerState;
  export type Props<T extends JSX.ElementType = "button"> = SelectTriggerProps<T>;
  export type OwnProps = SelectTriggerOwnProps;
  export type ChangeEventReason = SelectRoot.ChangeEventReason;
  export type ChangeEventDetails = SelectRoot.ChangeEventDetails;
}
