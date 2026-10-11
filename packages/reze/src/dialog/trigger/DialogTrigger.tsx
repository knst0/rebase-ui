import { createUniqueId, dynamicElement, effect, omitProps, onCleanup, type JSX } from "reze-js";

import { createButton } from "../../internals/create-button";
import { createChangeEventDetails, REASONS } from "../../internals/event-details";
import { resolveChildrenValue, resolveClassValue, resolveStyleValue } from "../../internals/renderProps";
import type { ButtonEventHandlers, NativeButtonProps, RebaseUIComponentProps } from "../../internals/types";
import type { DialogInteractionType } from "../root/createDialogRoot";
import { useDialogRootContext } from "../root/DialogRootContext";
import type { AttachedDialogRoot, DialogHandle } from "../store/DialogHandle";

/**
 * A button that opens the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Rebase UI Dialog](https://rebase-ui.knst.dev/components/dialog)
 */
export function DialogTrigger<Payload = unknown, T extends JSX.ElementType = "button">(props: DialogTrigger.Props<Payload, T>) {
  const rest = omitProps(props, "as", "disabled", "nativeButton", "id", "payload", "handle", "class", "style", "children", "ref");
  // Read once: invoking the children getter per binding run would recreate child components.
  const children = props.children;

  const parentContext = useDialogRootContext(true);
  const handle = props.handle as DialogHandle<Payload> | undefined;

  if (!parentContext && !handle) {
    throw new Error("Rebase UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.");
  }

  const thisTriggerId = props.id ?? createUniqueId();

  let triggerElement: HTMLElement | null = null;
  let unregisterTrigger: (() => void) | undefined;

  function register() {
    unregisterTrigger?.();
    unregisterTrigger = undefined;

    if (triggerElement === null) {
      return;
    }

    const resolved = parentContext ?? handle?.attached ?? undefined;
    unregisterTrigger = resolved
      ? resolved.registerTrigger(thisTriggerId, triggerElement)
      : handle?.registerPendingTrigger(thisTriggerId, triggerElement);
  }

  onCleanup(() => {
    unregisterTrigger?.();
    unregisterTrigger = undefined;
  });

  effect(() => {
    // Re-register when the attached root changes (a detached trigger mounting before its root).
    void (parentContext ?? handle?.attached);

    if (triggerElement !== null) {
      register();
    }
  });

  function handleClick(event: MouseEvent) {
    const resolved = parentContext ?? handle?.attached;

    if (!resolved) {
      throw new Error("Rebase UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.");
    }

    const activeTriggerId = resolved.activeTriggerId();

    // Toggle behavior: clicking the trigger of an open dialog closes it.
    // When the dialog is controlled by a triggerId the parent owns, the trigger always opens.
    if (resolved.open() && (activeTriggerId === undefined || activeTriggerId === thisTriggerId)) {
      resolved.setOpen(false, createChangeEventDetails(REASONS.triggerPress, event, triggerElement ?? undefined));
      return;
    }

    resolved.requestOpenByTrigger(
      thisTriggerId,
      triggerElement,
      props.payload as Payload | undefined,
      resolveInteractionType(event),
      createChangeEventDetails(REASONS.triggerPress, event, triggerElement ?? undefined),
    );
  }

  const button = createButton({
    get disabled() {
      return props.disabled;
    },
    get focusableWhenDisabled() {
      return true;
    },
    get nativeButton() {
      return props.nativeButton;
    },
    get ref() {
      return props.ref;
    },
    // A custom onClick replaces the trigger logic, mirroring the Solid layer order
    // where element props overwrite the internal trigger props.
    get onClick() {
      return props.onClick ?? handleClick;
    },
    get onMouseDown() {
      return props.onMouseDown;
    },
    get onKeyDown() {
      return props.onKeyDown;
    },
    get onKeyUp() {
      return props.onKeyUp;
    },
    get onPointerDown() {
      return props.onPointerDown;
    },
  });

  const Tag = dynamicElement<JSX.ElementType>(() => props.as ?? "button");

  function ref(element: HTMLElement | null) {
    triggerElement = element;

    if (element === null) {
      unregisterTrigger?.();
      unregisterTrigger = undefined;
    } else {
      register();
    }

    button.buttonRef(element);
  }

  return (
    <Tag
      {...(rest as Record<string, unknown>)}
      type={button.type}
      role={button.role}
      bool:disabled={button.disabled}
      tabindex={button.tabIndex}
      aria-disabled={button.ariaDisabled}
      id={thisTriggerId}
      aria-haspopup="dialog"
      aria-expanded={isOpenedByThisTrigger(parentContext ?? handle?.attached ?? undefined, thisTriggerId) ? "true" : "false"}
      aria-controls={
        isOpenedByThisTrigger(parentContext ?? handle?.attached ?? undefined, thisTriggerId)
          ? (parentContext ?? handle?.attached)?.popupId
          : undefined
      }
      data-disabled={props.disabled === true ? "" : undefined}
      data-popup-open={isOpenedByThisTrigger(parentContext ?? handle?.attached ?? undefined, thisTriggerId) ? "" : undefined}
      class={resolveClassValue(props.class, {
        disabled: props.disabled ?? false,
        open: isOpenedByThisTrigger(parentContext ?? handle?.attached ?? undefined, thisTriggerId),
      })}
      style={resolveStyleValue(props.style, {
        disabled: props.disabled ?? false,
        open: isOpenedByThisTrigger(parentContext ?? handle?.attached ?? undefined, thisTriggerId),
      })}
      onClick={button.onClick}
      onMouseDown={button.onMouseDown}
      onKeyDown={button.onKeyDown}
      onKeyUp={button.onKeyUp}
      onPointerDown={button.onPointerDown}
      ref={ref}
    >
      {resolveChildrenValue(children, () => ({
        disabled: props.disabled ?? false,
        open: isOpenedByThisTrigger(parentContext ?? handle?.attached ?? undefined, thisTriggerId),
      }))}
    </Tag>
  );
}

function isOpenedByThisTrigger(store: AttachedDialogRoot | undefined, thisTriggerId: string): boolean {
  if (!store || !store.open()) {
    return false;
  }

  const activeTriggerId = store.activeTriggerId();
  return activeTriggerId === undefined || activeTriggerId === null || activeTriggerId === thisTriggerId;
}

function resolveInteractionType(event: MouseEvent): DialogInteractionType {
  if ("pointerType" in event) {
    const pointerType = event.pointerType;
    if (pointerType === "mouse" || pointerType === "pen" || pointerType === "touch") {
      return pointerType;
    }
  }

  if (event.detail === 0) {
    return "keyboard";
  }

  return "mouse";
}

export interface DialogTriggerOwnProps<Payload = unknown> extends NativeButtonProps {
  disabled?: boolean | undefined;
  /**
   * The `id` attribute of the trigger.
   */
  id?: string | undefined;
  /**
   * A payload to pass to the dialog when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * A handle to associate the trigger with a dialog.
   * Can be created with the Dialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
}

export type DialogTriggerProps<Payload = unknown, T extends JSX.ElementType = "button"> = DialogTriggerOwnProps<Payload> &
  ButtonEventHandlers &
  RebaseUIComponentProps<T, DialogTriggerState>;

export interface DialogTriggerState {
  /**
   * Whether the trigger should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the dialog triggered by this trigger is currently open.
   */
  open: boolean;
}

export namespace DialogTrigger {
  export type State = DialogTriggerState;
  export type Props<Payload = unknown, T extends JSX.ElementType = "button"> = DialogTriggerProps<Payload, T>;
  export type OwnProps<Payload = unknown> = DialogTriggerOwnProps<Payload>;
}
